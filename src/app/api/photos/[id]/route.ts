import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/uploads";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const allowed = ["type", "caption", "annotations"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in d) data[k] = d[k];
  return NextResponse.json(await db.photo.update({ where: { id }, data }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const p = await db.photo.findUnique({ where: { id } });
  if (!p) return err("Not found", 404);
  await deleteUpload(p.filePath, p.thumbPath);
  await db.photo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
