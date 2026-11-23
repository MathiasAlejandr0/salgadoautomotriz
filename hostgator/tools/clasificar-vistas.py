#!/usr/bin/env python3
"""Clasifica cada foto de un auto: frente, 3/4 frontal, lateral, trasera o interior.

YOLO (el de objetos) no sirve: detecta «auto», no el ángulo. Esto usa CLIP
en cero disparos. No corre en el cron de HostGator; se ejecuta aquí y deja
photo_views.json para que el sync de PHP fije la portada.

  python3 hostgator/tools/clasificar-vistas.py /tmp/salgado-api.json
"""
from __future__ import annotations

import json
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image
import torch
from transformers import CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "api" / "_lib" / "photo_views.json"
LABELS = {
    "front_3q": "a front three-quarter photo of the whole vehicle outdoors, nose pointing to the right or left",
    "front": "a straight-on front photo of the whole vehicle outdoors",
    "side": "a side profile photo of a whole vehicle outdoors",
    "rear": "a rear photo of a vehicle, tailgate or back bumper",
    "interior": "a photo of a vehicle interior, dashboard, steering wheel or seats",
    "detail": "a close-up of a wheel, engine, open trunk, headlight or a document",
}


def load_images(api_path: Path) -> list[tuple[str, str, str]]:
    data = json.loads(api_path.read_text())
    vehicles = data["vehicles"] if isinstance(data, dict) else data
    rows = []
    for vehicle in vehicles:
        stock = str(vehicle.get("stock_id") or "")
        for image in vehicle.get("vehicle_images") or []:
            path = image.get("thumb_path") or image.get("storage_path") or ""
            file_id = ""
            name = path.rsplit("/", 1)[-1]
            for suffix in ("_t.webp", "_t.jpg", ".webp", ".jpg", ".jpeg", ".png"):
                if name.endswith(suffix):
                    file_id = name[: -len(suffix)]
                    break
            if stock and file_id and path.startswith("/uploads/drive/"):
                rows.append((stock, file_id, "https://salgadoautomotriz.cl" + path))
    return rows


def as_embed(output):
    if isinstance(output, torch.Tensor):
        return output
    for name in ("pooler_output", "text_embeds", "image_embeds"):
        value = getattr(output, name, None)
        if isinstance(value, torch.Tensor):
            return value
    raise TypeError(type(output))


def fetch(url: str) -> Image.Image | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SalgadoAutomotriz/1.1"})
        with urllib.request.urlopen(req, timeout=25) as response:
            return Image.open(BytesIO(response.read())).convert("RGB")
    except Exception:
        return None


def main() -> int:
    api = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/salgado-api.json")
    rows = load_images(api)
    device = "cpu"
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    texts = list(LABELS.values())
    keys = list(LABELS.keys())
    text_inputs = processor(text=texts, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        text_features = as_embed(model.get_text_features(**text_inputs))
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    views: dict[str, dict[str, float | str]] = {}
    batch: list[tuple[str, Image.Image]] = []

    def flush() -> None:
        if not batch:
            return
        images = [image for _, image in batch]
        inputs = processor(images=images, return_tensors="pt").to(device)
        with torch.no_grad():
            image_features = as_embed(model.get_image_features(**inputs))
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            scores = (image_features @ text_features.T).softmax(dim=-1)
        for (file_id, _), row in zip(batch, scores):
            winner = int(row.argmax())
            views[file_id] = {"view": keys[winner], "score": round(float(row[winner]), 4)}
        batch.clear()

    by_stock: dict[str, list[str]] = {}
    for index, (stock, file_id, url) in enumerate(rows, 1):
        image = fetch(url)
        by_stock.setdefault(stock, []).append(file_id)
        if image is None:
            continue
        batch.append((file_id, image))
        if len(batch) >= 16:
            flush()
            print(f"{index}/{len(rows)}", flush=True)
    flush()
    best_score = max((float(row["score"]) for row in views.values()), default=0.0)
    # En estas fotos de patio el modelo queda casi empatado (~0.17).
    # No se publica un mapa así: elegiría tablero o trasera al azar.
    if best_score < 0.35:
        print(f"no se escribe el mapa: la mejor confianza fue {best_score:.3f}")
        return 2
    OUT.write_text(json.dumps(views, ensure_ascii=False, indent=2) + "\n")
    print(f"vistas {len(views)} -> {OUT}")
    rank = {"front_3q": 3, "front": 2, "side": 1, "detail": 0, "rear": 0, "interior": 0}
    for stock, ids in sorted(by_stock.items()):
        labeled = [views[i] for i in ids if i in views]
        if not labeled:
            continue
        best = max(labeled, key=lambda item: (rank.get(str(item["view"]), 0), float(item["score"])))
        if rank.get(str(best["view"]), 0) >= 2:
            print(f"{stock}\t{best['view']}\t{best['score']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
