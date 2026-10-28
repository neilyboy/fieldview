import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookie, verifyPassword, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 });

  let ok = false;
  const setting = await db.setting.findUnique({ where: { id: 1 } });
  if (setting?.adminPassHash) {
    ok = username === process.env.ADMIN_USERNAME && verifyPassword(password, setting.adminPassHash);
  } else {
    // First boot: env credentials, then persist hash so admin can change it.
    ok = username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
    if (ok) {
      await db.setting.upsert({
        where: { id: 1 },
        update: { adminPassHash: hashPassword(password) },
        create: { id: 1, adminPassHash: hashPassword(password) },
      });
    }
  }
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(token));
  return res;
}
