import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(120),
  lat: z.number(), lng: z.number(),
  modelId: z.string().optional().nullable(),
  bearingDeg: z.number().min(0).max(360).optional(),
  fovDeg: z.number().min(5).max(360).optional().nullable(),
  rangeM: z.number().min(1).max(2000).optional().nullable(),
  headBearings: z.string().optional().nullable(),
  mountHeightM: z.number().optional().nullable(),
  mountType: z.string().optional().nullable(),
  surface: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return err("Invalid camera");
  const count = await db.camera.count({ where: { siteId: id } });
  const cam = await db.camera.create({
    data: { ...body.data, siteId: id, sortOrder: count },
    include: { model: true, photos: true },
  });
  return NextResponse.json(cam, { status: 201 });
}
