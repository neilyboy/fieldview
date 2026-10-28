import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const allowed = ["name", "family", "lensCount", "hfovDeg", "effectiveRangeM", "megapixels", "irRangeM", "notes"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in d) data[k] = d[k];
  return NextResponse.json(await db.cameraModel.update({ where: { id }, data }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  await db.cameraModel.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
