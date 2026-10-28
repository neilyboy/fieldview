import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/uploads";

const include = {
  cameras: { include: { model: true, photos: { orderBy: { createdAt: "asc" as const } } }, orderBy: { sortOrder: "asc" as const } },
  infra: { include: { photos: true }, orderBy: { createdAt: "asc" as const } },
  shares: { orderBy: { createdAt: "desc" as const } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, include });
  return site ? NextResponse.json(site) : err("Not found", 404);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const allowed = ["name", "clientName", "address", "notes", "centerLat", "centerLng", "defaultZoom"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in d) data[k] = d[k];
  return NextResponse.json(await db.site.update({ where: { id }, data }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, include: { cameras: { include: { photos: true } }, infra: { include: { photos: true } } } });
  if (!site) return err("Not found", 404);
  for (const p of [...site.cameras.flatMap((c) => c.photos), ...site.infra.flatMap((i) => i.photos)]) {
    await deleteUpload(p.filePath, p.thumbPath);
  }
  await db.site.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
