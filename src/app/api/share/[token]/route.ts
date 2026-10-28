import { NextRequest, NextResponse } from "next/server";
import { siteForToken } from "@/lib/shares";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = await siteForToken(token);
  if (!site) return NextResponse.json({ error: "Link invalid or expired" }, { status: 404 });
  const settings = await db.setting.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    site,
    branding: settings ? {
      companyName: settings.companyName, logoPath: settings.logoPath,
      primaryColor: settings.primaryColor, accentColor: settings.accentColor,
    } : null,
  });
}
