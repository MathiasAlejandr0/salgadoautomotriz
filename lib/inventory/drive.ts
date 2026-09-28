export type DriveEntry = {
  id: string;
  name: string;
  folder: boolean;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

export function parseDriveListing(html: string): DriveEntry[] {
  const chunks = html.split('class="flip-entry"').slice(1);
  const entries: DriveEntry[] = [];
  for (const chunk of chunks) {
    const id = chunk.match(/id="entry-([A-Za-z0-9_-]+)"/)?.[1];
    const name = chunk.match(/class="flip-entry-title">([^<]+)/)?.[1]?.trim();
    if (!id || !name) continue;
    entries.push({
      id,
      name,
      folder: chunk.includes('aria-label="Folder"'),
    });
  }
  return entries;
}

export function stockIdFromFolderName(name: string): string | null {
  const match = name.match(/\bID\s*(\d+)\b/i);
  return match ? match[1] : null;
}

export function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
}

export async function listDriveFolder(folderId: string): Promise<DriveEntry[]> {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "SalgadoAutomotriz/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Drive respondió ${res.status}`);
  return parseDriveListing(await res.text());
}

export async function photoUrlsForFolder(folderId: string, limit = 10): Promise<string[]> {
  const entries = await listDriveFolder(folderId);
  return entries
    .filter((entry) => !entry.folder && IMAGE_EXT.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
    .slice(0, limit)
    .map((entry) => driveImageUrl(entry.id));
}

/** stockId → ids de carpetas "ID 328" (puede haber duplicados). */
export function indexPhotoFolders(entries: DriveEntry[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.folder) continue;
    const stockId = stockIdFromFolderName(entry.name);
    if (!stockId) continue;
    const list = map.get(stockId) ?? [];
    list.push(entry.id);
    map.set(stockId, list);
  }
  return map;
}
