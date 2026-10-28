import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().max(200).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  centerLat: z.number().optional().nullable(),
  centerLng: z.number().optional().nullable(),
  defaultZoom: z.number().min(1).max(22).optional(),
});

export async function GET() {
  if (await guard()) return err("Unauthorized", 401);
  const sites = await db.site.findMany({
    include: { _count: { select: { cameras: true, shares: true } }, cameras: { select: { lat: true, lng: true }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  if (await guard()) return err("Unauthorized", 401);
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return err("Invalid site");
  const site = await db.site.create({ data: body.data });
  return NextResponse.json(site, { status: 201 });
}
