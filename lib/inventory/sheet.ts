import * as XLSX from "xlsx";

const FALLBACK_SHEET_ID = "1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc";
const DEFAULT_TAB = "SALGADO AUTOMOTRIZ";
const DEFAULT_DRIVE_FOLDER = "1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo";

export type SheetVehicle = {
  stockId: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: number;
  price: number;
  mileage: number | null;
  fuel: string | null;
  transmission: string | null;
  category: string;
  location: string;
  origin: string;
};

function googleId(value: string | undefined, fallback: string): string {
  const id = (value || fallback).trim();
  return /^[a-zA-Z0-9_-]{20,128}$/.test(id) ? id : fallback;
}

export function sheetId(): string {
  return googleId(process.env.GOOGLE_SHEET_ID, FALLBACK_SHEET_ID);
}

export function sheetTabName(): string {
  return (process.env.SALGADO_SHEET_TAB || DEFAULT_TAB).trim() || DEFAULT_TAB;
}

export function drivePhotosFolderId(): string {
  return googleId(process.env.DRIVE_PHOTOS_FOLDER_ID, DEFAULT_DRIVE_FOLDER);
}

function fold(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function col(header: unknown[], ...needles: string[]): number {
  return header.findIndex((cell) => {
    const label = fold(cell);
    return needles.some((needle) => label.includes(needle));
  });
}

export function cleanPlate(raw: unknown): string {
  const compact = String(raw ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const candidates = compact.length === 7 ? [compact, compact.slice(0, 6)] : [compact];
  for (const plate of candidates) {
    if (plate.length >= 5 && plate.length <= 6 && /^[A-Z]{2,4}\d{2,4}$/.test(plate)) {
      return plate;
    }
  }
  return "";
}

const BRANDS: Record<string, string> = {
  "MERCEDES BENZ": "Mercedes-Benz",
  "MERCEDES-BENZ": "Mercedes-Benz",
  MERCEDEZ: "Mercedes-Benz",
  "KIA MOTORS": "Kia",
  KIA: "Kia",
  VW: "Volkswagen",
  VOLSWAGEN: "Volkswagen",
  VOLKSWAGEN: "Volkswagen",
  SSANYONG: "SsangYong",
  SSANGYONG: "SsangYong",
  "GREAT WALL": "Great Wall",
  CHEVROLET: "Chevrolet",
  HYUNDAI: "Hyundai",
  PEUGEOT: "Peugeot",
  TOYOTA: "Toyota",
  NISSAN: "Nissan",
  MITSUBISHI: "Mitsubishi",
  RENAULT: "Renault",
  SUZUKI: "Suzuki",
  CHERY: "Chery",
  FORD: "Ford",
  MAXUS: "Maxus",
  DONGFENG: "Dongfeng",
  DONGBENG: "Dongfeng",
  FOTON: "Foton",
  GEELY: "Geely",
  JETOUR: "Jetour",
  VOLVO: "Volvo",
  OPEL: "Opel",
  JAC: "JAC",
  JMC: "JMC",
  MG: "MG",
  MINI: "MINI",
  BMW: "BMW",
};

export function cleanBrand(raw: unknown): string {
  const key = fold(raw).replace(/\s+/g, " ");
  if (!key) return "";
  if (BRANDS[key]) return BRANDS[key];
  return key
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function parseClp(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return n >= 1_000_000 ? n : 0;
  }
  const str = String(raw ?? "");
  if (/falta|reservado|vendido|entregado|sin\s+precio/i.test(str)) return 0;
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return n >= 1_000_000 ? n : 0;
}

export function parseKm(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  const str = String(raw);
  if (/falta|sin\s+km/i.test(str)) return null;
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function inferPowertrain(model: string): { fuel: string | null; transmission: string | null } {
  const m = model.toUpperCase();
  let fuel: string | null = null;
  if (/DIESEL|\bHDI\b|\bCRDI\b|\bDCI\b|\bTDI\b|\bTD\b/.test(m)) fuel = "Diésel";
  else if (/BENCINA|GASOLINA|PURETECH|\bMPI\b/.test(m)) fuel = "Bencina";

  let transmission: string | null = null;
  if (/\b(CVT|DCT|AUT|AT)\b|AUTOM/.test(m)) transmission = "Automática";
  else if (/\bMT\b|MECAN/.test(m)) transmission = "Manual";
  return { fuel, transmission };
}

export function guessCategory(model: string): string {
  const m = model.toUpperCase();
  if (/AMAROK|HILUX|NAVARA|RANGER|\bL200\b|WINGLE|\bT6\b|FRONTIER|SAVEIRO|COLORADO|RAPTOR|VIGUS/.test(m)) {
    return "Camioneta";
  }
  if (/VAN|PARTNER|EXPERT|BOXER|\bC35\b|CARGO|FURG|SPRINTER|BERLINGO|DELIVERY/.test(m)) {
    return "Furgón";
  }
  if (/\bDB\d|MOTO|SCOOT/.test(m)) return "Moto";
  if (
    /TUCSON|SANTA FE|SPORTAGE|RAIZE|TRACKER|CRETA|X-TRAIL|XTRAIL|REXTON|MONTERO|TIGGO|COOLRAY|MOKKA|CAPTUR|FORESTER|\bX70\b|\bGLE\b|\b2008\b|\b3008\b|ECOSPORT|\bZS\b|\bZX\b/.test(
      m
    )
  ) {
    return "SUV";
  }
  return "Automóvil";
}

function cell(row: unknown[], index: number): unknown {
  if (index < 0) return "";
  return row[index];
}

export function parseSalgadoRows(rows: unknown[][]): { vehicles: SheetVehicle[]; driveFolderId: string | null } {
  let driveFolderId: string | null = null;
  for (const row of rows.slice(0, 8)) {
    const text = row.map((c) => String(c ?? "")).join(" ");
    const match = text.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) driveFolderId = match[1];
  }

  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(fold);
    return labels.some((l) => l.includes("PATENTE")) && labels.some((l) => l.includes("MARCA"));
  });
  if (headerIndex < 0) return { vehicles: [], driveFolderId };

  const header = rows[headerIndex];
  const iOrigin = col(header, "ORIGEN");
  const iId = col(header, "ID");
  const iPlate = col(header, "PATENTE");
  const iBrand = col(header, "MARCA");
  const iModel = col(header, "MODELO");
  const iColor = col(header, "COLOR");
  const iYear = col(header, "ANO");
  const iPrice = col(header, "PRECIO");
  const iKm = col(header, "KILOMET");
  const iLocation = col(header, "UBICACION");

  const yearNow = new Date().getFullYear();
  const vehicles: SheetVehicle[] = [];
  const seen = new Set<string>();

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const plate = cleanPlate(cell(row, iPlate));
    const brand = cleanBrand(cell(row, iBrand));
    const model = String(cell(row, iModel) ?? "").trim();
    const year = parseInt(String(cell(row, iYear) ?? ""), 10) || 0;
    const price = parseClp(cell(row, iPrice));
    if (!plate || !brand || !model || year < 1990 || year > yearNow + 1 || price <= 0) continue;
    if (seen.has(plate)) continue;
    seen.add(plate);

    const power = inferPowertrain(model);
    const stockRaw = String(cell(row, iId) ?? "").replace(/[^\d]/g, "");
    vehicles.push({
      stockId: stockRaw || plate,
      plate,
      brand,
      model: model.toUpperCase(),
      color: titleCase(String(cell(row, iColor) ?? "").trim()),
      year,
      price,
      mileage: parseKm(cell(row, iKm)),
      fuel: power.fuel,
      transmission: power.transmission,
      category: guessCategory(model),
      location: titleCase(String(cell(row, iLocation) ?? "").trim()) || "Patio",
      origin: fold(cell(row, iOrigin)) || "STOCK",
    });
  }

  return { vehicles, driveFolderId };
}

export async function downloadWorkbook(): Promise<XLSX.WorkBook> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/export?format=xlsx`;
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "SalgadoAutomotriz/1.0" } });
  if (!res.ok) throw new Error(`Sheets respondió ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 80).toString("utf8");
  if (head.includes("<html") || head.includes("<!DOCTYPE")) {
    throw new Error("La planilla no está compartida como lectura pública");
  }
  return XLSX.read(buf, { type: "buffer" });
}

export async function fetchSalgadoSheet(): Promise<{ vehicles: SheetVehicle[]; driveFolderId: string | null }> {
  const workbook = await downloadWorkbook();
  const wanted = fold(sheetTabName());
  const name = workbook.SheetNames.find((sheet) => fold(sheet) === wanted);
  if (!name) throw new Error(`No está la pestaña ${sheetTabName()}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "" });
  return parseSalgadoRows(rows);
}
