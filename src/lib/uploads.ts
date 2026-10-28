import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "image/heic": ".heic", "image/heif": ".heif", "image/gif": ".gif",
};
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic",
};

export async function saveUpload(file: File): Promise<{ filePath: string; thumbPath: string | null; width: number | null; height: number | null }> {
  const id = randomUUID();
  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(UPLOAD_DIR);
  await mkdir(dir, { recursive: true });

  let width: number | null = null, height: number | null = null;
  let fileName: string, thumbName: string | null = null;

  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(buf).rotate(); // honor EXIF orientation
    const meta = await img.metadata();
    width = meta.width ?? null; height = meta.height ?? null;
    fileName = `${id}.jpg`;
    thumbName = `${id}_t.jpg`;
    await img.jpeg({ quality: 88 }).toFile(path.join(dir, fileName));
    await sharp(buf).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 }).toFile(path.join(dir, thumbName));
  } catch {
    // Not a processable image (e.g. HEIC that slipped through) — store raw.
    const ext = EXT[file.type] ?? ".bin";
    fileName = `${id}${ext}`;
    await writeFile(path.join(dir, fileName), buf);
  }
  return { filePath: fileName, thumbPath: thumbName, width, height };
}

export async function readUpload(name: string): Promise<{ data: Buffer; mime: string } | null> {
  const safe = path.basename(name); // no traversal
  try {
    const data = await readFile(path.join(UPLOAD_DIR, safe));
    return { data, mime: MIME[path.extname(safe).toLowerCase()] ?? "application/octet-stream" };
  } catch { return null; }
}

export async function deleteUpload(...names: (string | null | undefined)[]) {
  for (const n of names) {
    if (!n) continue;
    await unlink(path.join(UPLOAD_DIR, path.basename(n))).catch(() => {});
  }
}
