import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { printKey, isAuthed } from "@/lib/auth";
import { siteForToken } from "@/lib/shares";
import PrintDoc from "@/components/PrintDoc";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string; share?: string }>;
}) {
  const { id } = await params;
  const { key, share } = await searchParams;

  let allowed = await isAuthed();
  if (!allowed && key) allowed = key === printKey(id);
  if (!allowed && share) allowed = (await siteForToken(share))?.id === id;
  if (!allowed) notFound();

  const site = await db.site.findUnique({
    where: { id },
    include: {
      cameras: { include: { model: true, photos: { orderBy: { createdAt: "asc" } } }, orderBy: { sortOrder: "asc" } },
      infra: { include: { photos: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!site) notFound();
  const s = await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  return (
    <html>
      <head>
        <style>{`
          * { margin: 0; box-sizing: border-box; }
          html, body { background: #fff !important; }
          .print-page { break-after: page; }
          .print-page:last-child { break-after: auto; }
          @page { size: A4; margin: 0; }
        `}</style>
      </head>
      <body>
        <PrintDoc site={JSON.parse(JSON.stringify(site))} branding={JSON.parse(JSON.stringify(s))} />
      </body>
    </html>
  );
}
