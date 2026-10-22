import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeRetiredSlugs,
  planRetirement,
  purgeRetiredMedia,
  type PublicationRecord,
  type StoredMedia,
} from "../lib/inventory/retirement.ts";

function car(partial: Partial<PublicationRecord> & Pick<PublicationRecord, "slug">): PublicationRecord {
  return {
    legacySlugs: [],
    stock_id: null,
    plate: null,
    vehicle_images: [],
    ...partial,
  };
}

const photo = "https://lh3.googleusercontent.com/d/FOTO123=w1600";
const tour = "https://lh3.googleusercontent.com/d/TOURFILE/360.jpg";

test("un auto que sale de la planilla se retira con sus fotos y su recorrido", async () => {
  const previous = [
    car({
      slug: "ford-ranger-4x4-rojo-2023-n5f603a",
      legacySlugs: ["ford-ranger-4x4-2023"],
      stock_id: "11",
      vehicle_images: [{ storage_path: photo }, { storage_path: tour }, { storage_path: "/placeholder-car.svg" }],
    }),
    car({
      slug: "kia-morning-plateado-2015-14",
      legacySlugs: ["kia-morning-2015"],
      stock_id: "14",
      vehicle_images: [{ storage_path: "fotos/morning.jpg" }],
    }),
  ];
  const current = [previous[1]];

  const retired = planRetirement(previous, current);
  assert.equal(retired.length, 1);
  assert.deepEqual(retired[0].slugs.sort(), ["ford-ranger-4x4-2023", "ford-ranger-4x4-rojo-2023-n5f603a"]);
  assert.deepEqual(
    retired[0].media.map((item) => item.kind),
    ["photo", "tour"]
  );
  assert.equal(retired[0].media[0].driveFileId, "FOTO123");
  assert.equal(retired[0].media[1].driveFileId, "TOURFILE");
  assert.equal(retired[0].media.find((item) => item.url.includes("placeholder")), undefined);

  const deleted: StoredMedia[] = [];
  const removed = await purgeRetiredMedia(retired, async (media) => {
    deleted.push(media);
  });
  assert.equal(removed.length, 2);
  assert.deepEqual(
    deleted.map((item) => item.url),
    [photo, tour]
  );
  assert.equal(deleted.some((item) => item.url.includes("morning")), false);

  const slugs = mergeRetiredSlugs([], retired, current);
  assert.ok(slugs.includes("ford-ranger-4x4-2023"));
  assert.equal(slugs.includes("kia-morning-2015"), false);
});

test("una planilla vacía no borra el stock", () => {
  const previous = [car({ slug: "kia-morning-plateado-2015-14", stock_id: "14", vehicle_images: [{ storage_path: photo }] })];
  assert.deepEqual(planRetirement(previous, []), []);
});

test("el mismo id de stock no se retira aunque cambie el slug", () => {
  const previous = [car({ slug: "slug-viejo", stock_id: "11", legacySlugs: ["ford-ranger-4x4-2023"] })];
  const current = [car({ slug: "slug-nuevo", stock_id: "11", legacySlugs: ["slug-viejo"] })];
  assert.deepEqual(planRetirement(previous, current), []);
  assert.deepEqual(mergeRetiredSlugs(["slug-viejo"], [], current), []);
});
