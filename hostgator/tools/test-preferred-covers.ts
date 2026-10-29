/**
 * La tarjeta (resolveVehicleThumb) y la ficha (resolveVehicleGallery) usan la
 * primera foto local. La portada preferida tiene que ganar ahí, no solo en PHP.
 *
 *   npx tsx hostgator/tools/test-preferred-covers.ts
 */
import assert from "node:assert/strict";
import type { VehicleImage, VehicleWithImages } from "../../types/database";
import { resolveVehicleGallery, resolveVehicleImage, resolveVehicleThumb } from "../../lib/images";
import {
  hasLocalGallery,
  preferredCoverToken,
  takePublishedGallery,
  withPreferredCover,
} from "../../lib/preferred-covers";
import tokens from "../../hostgator/api/_lib/preferred_covers.json";

const FRONT = "1khZHcSQi6gSqatotPLre9qhsKHJM5AsB";
const DASH = "1vTZYw462LztK3Cq-72XjbyYEP-QQXDD9";

function img(partial: Pick<VehicleImage, "storage_path" | "sort_order"> & Partial<VehicleImage>): VehicleImage {
  return {
    id: partial.id ?? `img-${partial.sort_order}`,
    vehicle_id: partial.vehicle_id ?? "sa-316",
    storage_path: partial.storage_path,
    thumb_path: partial.thumb_path ?? null,
    sort_order: partial.sort_order,
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

function vehicle(stockId: string, images: VehicleImage[], slug = "ssangyong-new-rexton-lx-4x4-20-aut-azul-2023-316"): VehicleWithImages {
  return {
    id: `sa-${stockId}`,
    slug,
    brand: "SsangYong",
    model: "NEW REXTON",
    year: 2023,
    version: "Azul",
    category: "SUV",
    fuel: null,
    transmission: null,
    mileage: null,
    color: "Azul",
    doors: null,
    engine: null,
    price: 1,
    description: null,
    plate: null,
    stock_id: stockId,
    location: null,
    origin: null,
    status: "Disponible",
    published: true,
    featured: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    vehicle_images: images,
  };
}

const map = tokens as Record<string, string>;
assert.equal(Object.keys(map).length, 25);
assert.equal(map["316"], `drive:${FRONT}`);
assert.equal(map.RGBP20, "curated:da4fe0f31548/02");
assert.equal(map.HVHS94, "curated:5cf70ae2f9d5/02");
assert.equal(preferredCoverToken("316"), `drive:${FRONT}`);
assert.equal(preferredCoverToken("no-esta"), null);

const rexton = vehicle("316", [
  img({
    id: "dash",
    storage_path: `/uploads/drive/${DASH}.webp`,
    thumb_path: `/uploads/drive/${DASH}_t.webp`,
    sort_order: 0,
  }),
  img({
    id: "front",
    storage_path: `/uploads/drive/${FRONT}.webp`,
    thumb_path: `/uploads/drive/${FRONT}_t.webp`,
    sort_order: 1,
  }),
  img({
    id: "rear",
    storage_path: "/uploads/drive/1rearRearRearRearRearRR.webp",
    thumb_path: "/uploads/drive/1rearRearRearRearRearRR_t.webp",
    sort_order: 2,
  }),
]);

assert.equal(resolveVehicleThumb(rexton), `/uploads/drive/${FRONT}_t.webp`);
assert.equal(resolveVehicleImage(rexton), `/uploads/drive/${FRONT}.webp`);
const gallery = resolveVehicleGallery(rexton);
assert.deepEqual(gallery, [
  `/uploads/drive/${FRONT}.webp`,
  `/uploads/drive/${DASH}.webp`,
  "/uploads/drive/1rearRearRearRearRearRR.webp",
]);

const decoy = vehicle("316", [
  img({ id: "a", storage_path: "/uploads/drive/1aaaaaaaaaaaaaaaaaaaaaa.webp", sort_order: 0 }),
  img({ id: "decoy", storage_path: "/uploads/drive/1bbbbbbbbbbbbbbbbbbbbbb.webp", sort_order: 1 }),
  img({
    id: "front",
    storage_path: `/uploads/drive/${FRONT}.webp`,
    thumb_path: `/uploads/drive/${FRONT}_t.webp`,
    sort_order: 4,
  }),
]);
assert.equal(resolveVehicleImage(decoy), `/uploads/drive/${FRONT}.webp`);
assert.deepEqual(
  resolveVehicleGallery(decoy),
  [
    `/uploads/drive/${FRONT}.webp`,
    "/uploads/drive/1aaaaaaaaaaaaaaaaaaaaaa.webp",
    "/uploads/drive/1bbbbbbbbbbbbbbbbbbbbbb.webp",
  ]
);

const ram = vehicle(
  "RGBP20",
  [1, 2, 3, 4, 5].map((n) => {
    const file = String(n).padStart(2, "0");
    return img({
      id: file,
      vehicle_id: "sa-RGBP20",
      storage_path: `/uploads/curated/da4fe0f31548/${file}.webp`,
      thumb_path: `/uploads/curated/da4fe0f31548/${file}_t.webp`,
      sort_order: n - 1,
    });
  }),
  "ram-700-slt-blanco-2022-20"
);
assert.equal(resolveVehicleThumb(ram), "/uploads/curated/da4fe0f31548/02_t.webp");
assert.deepEqual(resolveVehicleGallery(ram).slice(0, 3), [
  "/uploads/curated/da4fe0f31548/02.webp",
  "/uploads/curated/da4fe0f31548/01.webp",
  "/uploads/curated/da4fe0f31548/03.webp",
]);
assert.equal(resolveVehicleGallery(ram).length, 5);

const sheet = vehicle("316", [
  img({
    storage_path: `https://lh3.googleusercontent.com/d/${DASH}=w1600`,
    sort_order: 0,
  }),
  img({
    storage_path: `https://lh3.googleusercontent.com/d/${FRONT}=w1600`,
    sort_order: 1,
  }),
]);
assert.equal(hasLocalGallery(sheet.vehicle_images), false);
assert.equal(resolveVehicleImage(sheet), "/placeholder-car.svg");

const fromApi = vehicle("316", rexton.vehicle_images);
const built = takePublishedGallery(sheet, fromApi);
assert.equal(resolveVehicleThumb(built), `/uploads/drive/${FRONT}_t.webp`);
assert.equal(resolveVehicleGallery(built).length, 3);
assert.equal(resolveVehicleGallery(built)[1], `/uploads/drive/${DASH}.webp`);

const stillRemote = takePublishedGallery(sheet, {
  stock_id: "316",
  vehicle_images: sheet.vehicle_images,
});
assert.equal(stillRemote.vehicle_images[0]?.storage_path, sheet.vehicle_images[0]?.storage_path);

const plain = withPreferredCover(
  [
    img({ id: "a", storage_path: "/uploads/drive/1aaaaaaaaaaaaaaaaaaaaaa.webp", sort_order: 0 }),
    img({ id: "b", storage_path: "/uploads/drive/1bbbbbbbbbbbbbbbbbbbbbb.webp", sort_order: 1 }),
  ],
  "no-esta"
);
assert.deepEqual(
  plain.map((item) => item.id),
  ["a", "b"]
);

console.log("portadas preferidas (build) ok");
