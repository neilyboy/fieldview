import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const patch = z.object({
  companyName: z.string().max(200).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  pdfFooterText: z.string().max(500).optional(),
  contactInfo: z.string().max(500).optional(),
});

export async function GET() {
  if (await guard()) return err("Unauthorized", 401);
  const s = await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const { adminPassHash: _, ...rest } = s;
  return NextResponse.json(rest);
}

export async function PATCH(req: NextRequest) {
  if (await guard()) return err("Unauthorized", 401);
  const body = patch.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return err("Invalid settings");
  const s = await db.setting.upsert({ where: { id: 1 }, update: body.data, create: { id: 1, ...body.data } });
  const { adminPassHash: _, ...rest } = s;
  return NextResponse.json(rest);
}
