import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { sitePdf, printQuery } from "@/lib/pdf";

export const maxDuration = 120;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id } });
  if (!site) return err("Not found", 404);
  try {
    const pdf = await sitePdf(id, printQuery(id), process.env.INTERNAL_BASE_URL ?? _req.nextUrl.origin);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${site.name.replace(/[^a-z0-9]+/gi, "-")}-site-plan.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF export failed", e);
    return err("PDF generation failed", 500);
  }
}
