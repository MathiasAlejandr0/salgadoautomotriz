import { ImageResponse } from "next/og";
import { getVehicleBySlug } from "@/lib/queries";
import { resolveVehicleImage } from "@/lib/images";
import { vehicleHeading } from "@/lib/vehicle-public";
import { SITE } from "@/lib/site";

export const revalidate = 600;

function rasterPhoto(src: string): string | null {
  if (!src || src.endsWith(".svg") || src.includes("placeholder-car")) return null;
  if (src.startsWith("http")) return src;
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) {
    return new Response("Not found", { status: 404 });
  }

  const photo = await photoData(rasterPhoto(resolveVehicleImage(vehicle)));
  const heading = vehicleHeading(vehicle);
  const image = renderOg(photo, heading);
  image.headers.set("content-type", "image/png");
  image.headers.set("cache-control", "public, max-age=600, s-maxage=600");
  return image;
}

async function photoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/") || type.includes("svg")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100 || bytes.length > 8_000_000) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function renderOg(photo: string | null, heading: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#050a14",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {photo ? (
          // satori (ImageResponse) solo pinta <img>, no next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={1200} height={630} style={{ width: "1200px", height: "630px", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: "100%",
              height: "100%",
              padding: "56px",
              background: "#050a14",
            }}
          >
            <div style={{ fontSize: 28, letterSpacing: 4, color: "#00BCFE" }}>{SITE.name}</div>
            <div style={{ fontSize: 64, fontWeight: 800, marginTop: 16 }}>{heading}</div>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
