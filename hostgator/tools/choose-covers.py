#!/usr/bin/env python3
"""Elige la portada de cada unidad con CLIP (gratis, local).

Regla de Mathias: 3/4 frontal mirando a la derecha (frente + costado, el auto
orientado hacia la derecha de la imagen); si no, 3/4 al otro lado; si no,
frontal puro; si no, cualquier exterior. Nunca interior ni trasera si hay
otra foto usable.

No pisa el mapa manual (preferred_covers.json). Escribe auto_covers.json
para que el sync de PHP lo lea. HostGator no corre el modelo: este script
se ejecuta en el box o en GitHub Actions.

  python3 hostgator/tools/choose-covers.py \\
    --photos /tmp/salgado-drive-photos.json \\
    --out hostgator/api/_lib/auto_covers.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parents[2]
REF_PATH = Path(__file__).resolve().parent / "cover-refs/frente-34-derecha.png"
MANUAL_PATH = ROOT / "hostgator/api/_lib/preferred_covers.json"
DEFAULT_OUT = ROOT / "hostgator/api/_lib/auto_covers.json"
REF_DIR = ROOT / "hostgator/tools/cover-refs"
MODEL_ID = "openai/clip-vit-base-patch32"

# Prioridad: primero la clase más deseable.
# Prompts de contraste (más fiables que mezclar todo en un solo softmax).
FRONT_PROMPTS = [
    "front of a car with headlights and grille facing the camera",
    "three-quarter front view of a car, headlights visible, parked outdoors",
]
RIGHT_PROMPTS = [
    "front three-quarter view of a car or pickup facing toward the right of the photo, front and left side visible",
]
LEFT_PROMPTS = [
    "front three-quarter view of a car or pickup facing toward the left of the photo, front and right side visible",
]
REAR_PROMPTS = [
    "rear of a car with tail lights and trunk or tailgate facing the camera",
    "back three-quarter view of a car or pickup, tail lights and rear bumper visible",
]
INTERIOR_PROMPTS = [
    "car interior dashboard steering wheel and seats",
    "photo taken from inside a car, dashboard, steering wheel, cabin",
    "close-up of a car gear shift, seats or door panel inside the cabin",
]
ENGINE_PROMPTS = [
    "car engine bay with the hood open, engine and battery visible",
    "photo of a car motor compartment, hood raised, mechanical parts",
]
CLOSEUP_PROMPTS = [
    "extreme close-up of a car grille logo or license plate, cropped tight, not the whole vehicle",
    "tight crop of a car badge, emblem or front plate only, no wheels visible",
]
SIDE_PROMPTS = [
    "side profile of a car photographed from the side, both wheels in a line, headlights not facing the camera",
]
FRONTISH_PROMPTS = [
    "three-quarter or front view of a car with the grille and headlights clearly visible",
]
HEADLIGHTS_PROMPTS = [
    "vehicle headlights and front grille clearly visible, front of the vehicle",
]
TAILLIGHT_PROMPTS = [
    "tail lights and rear doors of a truck, the back of the cargo box",
]
CARGO_PROMPTS = [
    "empty cargo area of a van, bare metal floor and interior walls, no dashboard or steering wheel",
]
WHOLEFRONT_PROMPTS = [
    "full photograph of a complete car or pickup from the front or three-quarter front, headlights, wheels and body visible, parked outdoors",
]
GROUPS = {
    "front": FRONT_PROMPTS,
    "right": RIGHT_PROMPTS,
    "left": LEFT_PROMPTS,
    "rear": REAR_PROMPTS,
    "interior": INTERIOR_PROMPTS,
    "engine": ENGINE_PROMPTS,
    "closeup": CLOSEUP_PROMPTS,
    "side": SIDE_PROMPTS,
    "frontish": FRONTISH_PROMPTS,
    "headlights": HEADLIGHTS_PROMPTS,
    "taillight": TAILLIGHT_PROMPTS,
    "cargo": CARGO_PROMPTS,
    "wholefront": WHOLEFRONT_PROMPTS,
}


def load_json(path: Path):
    return json.loads(path.read_text())


def manual_tokens() -> dict[str, str]:
    if not MANUAL_PATH.is_file():
        return {}
    data = load_json(MANUAL_PATH)
    return {str(k): v for k, v in data.items() if isinstance(v, str)}


def download(file_id: str, cache: Path) -> Path | None:
    dest = cache / f"{file_id}.jpg"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    live = f"https://salgadoautomotriz.cl/uploads/drive/{file_id}_t.webp"
    urls = [
        f"https://lh3.googleusercontent.com/d/{file_id}=w640",
        f"https://drive.google.com/thumbnail?id={file_id}&sz=w640",
        live,
        f"https://salgadoautomotriz.cl/uploads/drive/{file_id}.webp",
    ]
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SalgadoCover/1.0"})
            with urllib.request.urlopen(req, timeout=20) as res:
                data = res.read()
            if not data or len(data) < 800:
                continue
            tmp = dest.with_suffix(".tmp")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return dest
        except Exception:
            continue
    return None


NAME_HINTS = [
    (r"interior|tablero|dashboard|asiento|cabin|asientos", "interior"),
    (r"motor|engine|capot|capo|compartimiento", "engine"),
    (r"detalle|close.?up|placa|logo", "closeup"),
    (r"trasera|trasero|rear|cola|maletero|tailgate", "rear"),
    (r"frente|frontal|front|delantera", "front"),
]


def name_hint(name: str) -> str | None:
    n = name.lower()
    for pat, label in NAME_HINTS:
        if re.search(pat, n):
            return label
    return None


def open_image(path: Path) -> Image.Image | None:
    try:
        img = Image.open(path)
        return img.convert("RGB")
    except Exception:
        return None


def build_model(device: str):
    model = CLIPModel.from_pretrained(MODEL_ID).to(device)
    model.eval()
    processor = CLIPProcessor.from_pretrained(MODEL_ID)
    return model, processor


@torch.no_grad()
def encode_texts(model, processor, device, texts: list[str]):
    inputs = processor(text=texts, return_tensors="pt", padding=True, truncation=True)
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs.get("attention_mask")
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    pooled = model.text_model(input_ids=input_ids, attention_mask=attention_mask).pooler_output
    return F.normalize(model.text_projection(pooled), dim=-1)


@torch.no_grad()
def group_text_embeds(model, processor, device):
    labels = []
    texts = []
    for group, prompts in GROUPS.items():
        for p in prompts:
            labels.append(group)
            texts.append(p)
    return labels, encode_texts(model, processor, device, texts)


@torch.no_grad()
def image_embeds_batch(model, processor, device, images: list[Image.Image], bs: int = 16):
    if not images:
        return torch.empty(0, 512)
    chunks = []
    for i in range(0, len(images), bs):
        inputs = processor(images=images[i:i + bs], return_tensors="pt")
        pixel = inputs["pixel_values"].to(device)
        pooled = model.vision_model(pixel_values=pixel).pooler_output
        chunks.append(F.normalize(model.visual_projection(pooled), dim=-1))
    return torch.cat(chunks, dim=0)


def group_scores(labels, text_emb, img_emb) -> dict[str, float]:
    sims = (img_emb @ text_emb.T).squeeze(0)
    buckets: dict[str, list[float]] = {g: [] for g in GROUPS}
    for label, s in zip(labels, sims.tolist()):
        buckets[label].append(float(s))
    return {g: (max(v) if v else -1.0) for g, v in buckets.items()}


def assign_class(scores: dict[str, float], name: str = "") -> str:
    front = max(scores["front"], scores["right"], scores["left"])
    rear = scores["rear"]
    interior = scores["interior"]
    engine = scores.get("engine", -1.0)
    closeup = scores.get("closeup", -1.0)
    side = scores.get("side", -1.0)
    frontish = scores.get("frontish", scores["front"])
    headlights = scores.get("headlights", scores["front"])
    taillight = scores.get("taillight", rear)
    cargo = scores.get("cargo", -1.0)
    whole = scores.get("wholefront", front)
    hint = name_hint(name)
    if hint == "interior":
        interior += 0.04
    elif hint == "rear":
        rear += 0.04
    elif hint == "front":
        front += 0.03
    elif hint == "engine":
        engine += 0.04
    elif hint == "closeup":
        closeup += 0.04
    # Detalles que no sirven de portada, aunque CLIP los vea "frontales".
    if closeup >= whole + 0.015 and closeup >= 0.26:
        return "closeup"
    if cargo >= whole + 0.04 and cargo >= 0.30:
        return "interior"
    if engine >= front + 0.015 and engine >= whole + 0.01:
        return "engine"
    # Contraste claro: interior o trasera se deciden antes que el ángulo 3/4.
    if interior >= front + 0.01 and interior >= rear + 0.01:
        return "interior"
    # Trasera de furgón/caja: faros traseros ganan a la parrilla.
    if taillight >= headlights + 0.005 and taillight >= scores["front"] + 0.02:
        return "rear"
    # 3/4 trasero suele tener rear > front; el umbral 0.02 evita furgones de frente.
    if rear >= scores["front"] + 0.02:
        return "rear"
    # Perfil lateral (no 3/4 frontal): el costado supera claramente a la parrilla.
    if side >= headlights + 0.03 and side >= frontish + 0.02:
        return "side"
    # Ángulo de portada entre las frontales.
    # CLIP invierte izq/der respecto de la foto: el grupo "left" es el de la
    # referencia de Mathias (auto hacia la derecha de la imagen, costado
    # izquierdo visible). Las clases front_34_* siguen el sentido de la FOTO.
    right, left, straight = scores["right"], scores["left"], scores["front"]
    if left >= right + 0.004 and left >= straight - 0.01:
        return "front_34_right"
    if right >= left + 0.004 and right >= straight - 0.01:
        return "front_34_left"
    if straight >= max(right, left) + 0.004:
        return "front"
    # Empate: preferir la orientación de la referencia (grupo CLIP "left").
    if max(right, left) >= straight - 0.01:
        return "front_34_right" if left >= right else "front_34_left"
    return "front"


USABLE = {"front_34_right", "front_34_left", "front"}
PRIORITY = ["front_34_right", "front_34_left", "front", "exterior", "rear", "interior"]


def cover_quality(photo: dict) -> float:
    s = photo.get("scores") or {}
    # Ligera preferencia por la orientación de la referencia (CLIP "left").
    # Suma contraste frente/trasera para no preferir un 3/4 trasero mal etiquetado.
    angle = max(s.get("left", -1.0) + 0.006, s.get("right", -1.0), s.get("front", -1.0))
    contrast = s.get("front", 0.0) - s.get("rear", 0.0)
    lights = s.get("headlights", s.get("front", 0.0)) - s.get("taillight", s.get("rear", 0.0))
    q = angle + 0.6 * contrast + 0.35 * lights
    # Solo como desempate entre fotos ya clasificadas como frontales (nunca contra interior/trasera).
    if photo.get("ref_sim") is not None:
        q += 0.3 * float(photo["ref_sim"])
    return q


def is_three_quarter_front(photo: dict) -> bool:
    if photo.get("cls") not in {"front_34_right", "front_34_left"}:
        return False
    s = photo.get("scores") or {}
    # Un 3/4 con rear > front es casi seguro un 3/4 trasero mal etiquetado.
    return (s.get("front", 0.0) - s.get("rear", 0.0)) >= -0.005


def pick_cover(photos: list[dict]) -> dict | None:
    usable = [p for p in photos if p["cls"] in USABLE]
    if usable:
        threes = [p for p in usable if is_three_quarter_front(p)]
        return max(threes or usable, key=cover_quality)
    pool = [p for p in photos if p["cls"] != "interior"] or photos
    return max(pool, key=cover_quality) if pool else None


def current_first_from_api(api: dict, stock_id: str) -> dict | None:
    v = api.get(stock_id)
    if not v:
        return None
    imgs = v.get("vehicle_images") or []
    if not imgs:
        return None
    first = imgs[0]
    path = first.get("storage_path") or ""
    file_id = first.get("drive_file_id") or ""
    m = re.search(r"/uploads/drive/([A-Za-z0-9_-]+)", path)
    if m:
        file_id = file_id or m.group(1)
    return {"path": path, "drive_file_id": file_id, "vehicle": v}


def fetch_api() -> dict:
    url = "https://salgadoautomotriz.cl/api/vehicles"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SalgadoCover/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode())
    except Exception as exc:
        print(f"API pública no disponible: {exc}", file=sys.stderr)
        return {}
    out = {}
    for v in data.get("vehicles") or []:
        if isinstance(v, dict) and v.get("stock_id"):
            out[str(v["stock_id"])] = v
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--photos", required=True, help="JSON de dump-drive-photos.php")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--report", default="")
    parser.add_argument("--cache", default="")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--ref", default=str(REF_PATH), help="Foto de referencia 3/4 a la derecha")
    args = parser.parse_args()

    photos_path = Path(args.photos)
    payload = load_json(photos_path)
    vehicles = payload.get("vehicles") or []
    if args.limit:
        vehicles = vehicles[: args.limit]
    cache = Path(args.cache) if args.cache else Path("/tmp/salgado-cover-cache")
    cache.mkdir(parents=True, exist_ok=True)

    device = "cpu"
    print(f"Cargando {MODEL_ID} en {device}…", file=sys.stderr)
    model, processor = build_model(device)
    labels, text_emb = group_text_embeds(model, processor, device)

    ref_embed = None
    ref_path = Path(args.ref) if args.ref else REF_PATH
    if ref_path.is_file():
        ref_img = open_image(ref_path)
        if ref_img is not None:
            ref_embed = image_embeds_batch(model, processor, device, [ref_img])
            print(f"referencia {ref_path}", file=sys.stderr)
    else:
        print(f"sin foto de referencia ({ref_path})", file=sys.stderr)

    api = fetch_api()
    manual = manual_tokens()
    auto: dict[str, str] = {}
    report = []

    # Descarga (o usa caché) y clasifica en lote.
    jobs = []
    for veh in vehicles:
        for f in veh.get("files") or []:
            if f.get("id"):
                jobs.append((str(veh.get("stock_id") or ""), f))
    print(f"Preparando {len(jobs)} fotos…", file=sys.stderr)
    loaded = []
    for stock, f in jobs:
        path = download(f["id"], cache)
        img = open_image(path) if path is not None else None
        loaded.append((stock, f, img))
    ok_imgs = [img for *_, img in loaded if img is not None]
    print(f"Embed de {len(ok_imgs)} fotos…", file=sys.stderr)
    t0 = time.time()
    embeds = image_embeds_batch(model, processor, device, ok_imgs, bs=16)
    print(f"embeds en {time.time() - t0:.0f}s", file=sys.stderr)
    emb_i = 0
    by_stock: dict[str, list[dict]] = {}
    for stock, f, img in loaded:
        if img is None:
            by_stock.setdefault(stock, []).append({"id": f["id"], "name": f.get("name") or "", "cls": "missing", "scores": {}, "ok": False})
            continue
        emb = embeds[emb_i:emb_i + 1]
        emb_i += 1
        scores = group_scores(labels, text_emb, emb)
        cls = assign_class(scores, f.get("name") or "")
        ref_sim = None
        if ref_embed is not None:
            ref_sim = round(float((emb @ ref_embed.T).squeeze()), 4)
        by_stock.setdefault(stock, []).append({
            "id": f["id"],
            "name": f.get("name") or "",
            "cls": cls,
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "ref_sim": ref_sim,
            "ok": True,
        })

    by_id = {str(v.get("stock_id") or ""): v for v in vehicles}
    for stock, classified in by_stock.items():
        veh = by_id.get(stock) or {}
        ok = [p for p in classified if p["ok"]]
        chosen = pick_cover(ok)
        current = current_first_from_api(api, stock)
        current_cls = None
        if current and current.get("drive_file_id"):
            match = next((p for p in ok if p["id"] == current["drive_file_id"]), None)
            if match:
                current_cls = match["cls"]
        elif current and current.get("path"):
            current_cls = "unknown_live"

        row = {
            "stock_id": stock,
            "plate": veh.get("plate"),
            "brand": veh.get("brand"),
            "model": veh.get("model"),
            "year": veh.get("year"),
            "photos": len(ok),
            "chosen": None if not chosen else {
                "id": chosen["id"],
                "name": chosen["name"],
                "cls": chosen["cls"],
                "scores": chosen["scores"],
                "ref_sim": chosen.get("ref_sim"),
            },
            "current_first": None if not current else {
                "path": current.get("path"),
                "drive_file_id": current.get("drive_file_id"),
                "cls": current_cls,
            },
            "classes": dict(__import__('collections').Counter(p["cls"] for p in ok)),
            "manual": stock in manual,
            "changed_from_bad": bool(
                chosen
                and current_cls in {"interior", "rear"}
                and chosen["cls"] in {"front_34_right", "front_34_left", "front"}
            ),
        }
        report.append(row)
        if chosen and stock not in manual:
            auto[stock] = f"drive:{chosen['id']}"

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(auto, indent=2, ensure_ascii=False) + "\n")
    report_path = Path(args.report) if args.report else out_path.with_name("auto_covers_report.json")
    report_path.write_text(json.dumps({
        "model": MODEL_ID,
        "vehicles": len(report),
        "auto_covers": len(auto),
        "manual_kept": sum(1 for r in report if r["manual"]),
        "changed_from_bad": [r for r in report if r["changed_from_bad"]],
        "rows": report,
    }, indent=2, ensure_ascii=False) + "\n")

    bad = [r for r in report if r["changed_from_bad"]]
    missing = [r for r in report if r["photos"] == 0]
    print(f"auto_covers: {len(auto)} (manuales conservadas: {sum(1 for r in report if r['manual'])})", file=sys.stderr)
    print(f"portadas que eran interior/trasera y ahora son exteriores: {len(bad)}", file=sys.stderr)
    print(f"sin fotos de Drive: {len(missing)}", file=sys.stderr)
    print(f"escrito {out_path}", file=sys.stderr)
    print(f"reporte {report_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
