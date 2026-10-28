import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(60),
  family: z.enum(["dome", "bullet", "mini", "fisheye", "multisensor", "ptz"]),
  lensCount: z.number().int().min(1).max(8).optional(),
  hfovDeg: z.number().min(5).max(360),
  effectiveRangeM: z.number().min(1).max(2000),
  megapixels: z.number().optional().nullable(),
  irRangeM: z.number().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET() {
  // readable by admin pages AND client share view (specs) — non-sensitive
  return NextResponse.json(await db.cameraModel.findMany({ orderBy: [{ family: "asc" }, { name: "asc" }] }));
}

export async function POST(req: NextRequest) {
  if (await guard()) return err("Unauthorized", 401);
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return err("Invalid model");
  const m = await db.cameraModel.create({ data: { ...body.data, isBuiltin: false } });
  return NextResponse.json(m, { status: 201 });
}
