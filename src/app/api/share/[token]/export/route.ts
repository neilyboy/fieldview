import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { siteForToken } from "@/lib/shares";
import { sitePdf } from "@/lib/pdf";

export const maxDuration = 120;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = await siteForToken(token);
  if (!site) return err("Link invalid or expired", 404);
  try {
    const pdf = await sitePdf(site.id, `?share=${token}`, process.env.INTERNAL_BASE_URL ?? _req.nextUrl.origin);
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
