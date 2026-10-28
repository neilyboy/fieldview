import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import SiteEditor from "@/components/SiteEditor";

export const dynamic = "force-dynamic";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: {
      cameras: { include: { model: true, photos: { orderBy: { createdAt: "asc" } } }, orderBy: { sortOrder: "asc" } },
      infra: { include: { photos: true }, orderBy: { createdAt: "asc" } },
      shares: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!site) notFound();
  const models = await db.cameraModel.findMany({ orderBy: [{ family: "asc" }, { name: "asc" }] });
  return <SiteEditor initialSite={JSON.parse(JSON.stringify(site))} models={JSON.parse(JSON.stringify(models))} />;
}
