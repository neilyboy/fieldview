import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const d = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("expiresAt" in d) data.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
  if ("revoked" in d) data.revokedAt = d.revoked ? new Date() : null;
  if ("label" in d) data.label = d.label;
  return NextResponse.json(await db.shareLink.update({ where: { id }, data }));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  await db.shareLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
