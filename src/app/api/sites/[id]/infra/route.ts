import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["idf", "switch", "cablePath", "note"]),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return err("Invalid infra item");
  return NextResponse.json(await db.infraItem.create({ data: { ...body.data, siteId: id }, include: { photos: true } }), { status: 201 });
}
