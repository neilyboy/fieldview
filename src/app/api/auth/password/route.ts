import { NextRequest, NextResponse } from "next/server";
import { requireAuth, verifyPassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { current, next } = await req.json().catch(() => ({}));
  if (!next || next.length < 8) return NextResponse.json({ error: "New password must be 8+ chars" }, { status: 400 });
  const s = await db.setting.findUnique({ where: { id: 1 } });
  const stored = s?.adminPassHash;
  const okCurrent = stored ? verifyPassword(current ?? "", stored) : current === process.env.ADMIN_PASSWORD;
  if (!okCurrent) return NextResponse.json({ error: "Current password incorrect" }, { status: 403 });
  await db.setting.upsert({ where: { id: 1 }, update: { adminPassHash: hashPassword(next) }, create: { id: 1, adminPassHash: hashPassword(next) } });
  return NextResponse.json({ ok: true });
}
