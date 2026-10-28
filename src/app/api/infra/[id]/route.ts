import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/uploads";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const allowed = ["type", "title", "description", "lat", "lng"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in d) data[k] = d[k];
  return NextResponse.json(await db.infraItem.update({ where: { id }, data, include: { photos: true } }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const item = await db.infraItem.findUnique({ where: { id }, include: { photos: true } });
  if (!item) return err("Not found", 404);
  for (const p of item.photos) await deleteUpload(p.filePath, p.thumbPath);
  await db.infraItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
