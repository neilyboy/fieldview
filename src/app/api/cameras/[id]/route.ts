import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/uploads";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const allowed = ["name", "lat", "lng", "bearingDeg", "fovDeg", "rangeM", "headBearings", "modelId", "mountHeightM", "mountType", "surface", "notes", "sortOrder"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in d) data[k] = d[k];
  return NextResponse.json(await db.camera.update({ where: { id }, data, include: { model: true, photos: true } }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const cam = await db.camera.findUnique({ where: { id }, include: { photos: true } });
  if (!cam) return err("Not found", 404);
  for (const p of cam.photos) await deleteUpload(p.filePath, p.thumbPath);
  await db.camera.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
