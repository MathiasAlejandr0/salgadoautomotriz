import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const PLATE = /\b(?:[A-Z]{4}\d{2}|[A-Z]{2}\d{4})\b/i;

async function html(request: APIRequestContext, path: string) {
  const response = await request.get(path, { headers: { "user-agent": GOOGLEBOT } });
  return { response, body: await response.text() };
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => {
    const url = new URL(match[1]);
    return `${url.pathname}${url.search}`;
  });
}

test("el sitemap no entrega fichas vacías a Googlebot", async ({ request }) => {
  const sitemap = await html(request, "/sitemap.xml");
  expect(sitemap.response.status()).toBe(200);
  const paths = locs(sitemap.body).filter((path) => path.startsWith("/catalogo/detalle/"));
  expect(paths.length).toBeGreaterThan(10);

  for (const path of paths) {
    const page = await html(request, path);
    expect(page.response.status(), path).toBe(200);
    expect(page.body.toLowerCase(), path).not.toContain("no encontrado");
    expect(page.body, path).not.toContain("noindex");
    expect(page.body, path).toContain("<h1");
    expect(page.body, path).not.toMatch(PLATE);
    expect(page.body.toLowerCase(), path).not.toContain("patente");
  }
});

test("catálogo, ficha, WhatsApp y Open Graph", async ({ page, request }) => {
  const catalog = await html(request, "/catalogo");
  expect(catalog.response.status()).toBe(200);
  const links = [...catalog.body.matchAll(/href="(\/catalogo\/detalle\/[^"]+)"/g)].map((match) => match[1]);
  expect(links.length).toBeGreaterThan(5);

  await page.goto("/catalogo");
  await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
  const card = page.locator('a[href^="/catalogo/detalle/"]').first();
  await expect(card).toBeVisible();
  await expect(card.getByText("Pie mínimo", { exact: true })).toBeVisible();

  const href = await card.getAttribute("href");
  expect(href).toBeTruthy();
  await card.click();
  await expect(page).toHaveURL(new RegExp(href!));

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  const title = await page.title();
  expect(title.toLowerCase()).not.toContain("no encontrado");
  expect(await h1.innerText()).not.toMatch(PLATE);

  const whatsapp = page.getByRole("link", { name: "Escribir por WhatsApp" });
  await expect(whatsapp).toBeVisible();
  const wa = await whatsapp.getAttribute("href");
  expect(wa).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  expect(wa).not.toMatch(PLATE);

  const og = page.locator('meta[property="og:image"]');
  await expect(og).toHaveCount(1);
  const ogUrl = await og.getAttribute("content");
  expect(ogUrl).toMatch(/\/og\/vehiculo\/.+/);
  const image = await request.get(new URL(ogUrl!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const bytes = await image.body();
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);

  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  const graph = ld.map((item) => JSON.parse(item));
  const car = graph.find((item) => item["@type"] === "Car");
  expect(car).toBeTruthy();
  expect(car.offers["@type"]).toBe("Offer");
  expect(car.offers.priceCurrency).toBe("CLP");
  expect(car.offers.price).toBeGreaterThan(0);
  expect(car.offers.availability).toContain("schema.org");
  expect(car.vehicleCondition).toBe("https://schema.org/UsedCondition");
  expect(car.brand.name).toBeTruthy();
  expect(car.modelDate).toMatch(/^\d{4}$/);
  expect(car.image[0]).not.toMatch(/\.svg($|\?)/);
  expect(JSON.stringify(car)).not.toMatch(PLATE);
  expect(graph.some((item) => item["@type"] === "BreadcrumbList")).toBe(true);

  const home = await html(request, "/");
  expect(home.body).toContain("AutoDealer");
  expect(home.body).toContain("WebSite");
  expect(home.body).toMatch(/property="og:image" content="[^"]*\/og\.png"/);
  expect(home.body).not.toMatch(/property="og:image" content="[^"]+\.svg/);
});

test("un slug inexistente responde 404", async ({ request }) => {
  const response = await request.get("/catalogo/detalle/auto-que-no-existe-2099", {
    headers: { "user-agent": GOOGLEBOT },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
  const body = await response.text();
  expect(body.toLowerCase()).not.toContain("no encontrado");
});

test("mayúsculas en el slug redirigen al canónico", async ({ request }) => {
  const sitemap = await html(request, "/sitemap.xml");
  const path = locs(sitemap.body).find((item) => item.startsWith("/catalogo/detalle/"));
  expect(path).toBeTruthy();
  const upper = path!.replace("/catalogo/detalle/", "/catalogo/detalle/").replace(
    /\/detalle\/(.)/,
    (_, letter: string) => `/detalle/${letter.toUpperCase()}`
  );
  const response = await request.get(upper, { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toContain(path);
});

async function axe(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test("axe sin violaciones serias", async ({ page }) => {
  await axe(page, "/");
  await axe(page, "/catalogo");
  const href = await page.locator('a[href^="/catalogo/detalle/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await axe(page, href!);
});

test("capturas a 390 y 1440", async ({ page }) => {
  const shots: { path: string; file: string }[] = [
    { path: "/", file: "inicio" },
    { path: "/catalogo", file: "catalogo" },
  ];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const shot of shots) {
      await page.goto(shot.path);
      await page.screenshot({
        path: `/opt/cursor/artifacts/screenshots/${shot.file}-${width}.png`,
        fullPage: false,
      });
    }
    const href = await page.locator('a[href^="/catalogo/detalle/"]').first().getAttribute("href");
    await page.goto(href!);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/ficha-${width}.png`,
      fullPage: false,
    });
  }
});
