"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SiteMap, { type Cam, type Infra } from "@/components/map/SiteMap";
import PhotoView from "@/components/PhotoView";

type CamX = Cam & {
  mountHeightM?: number | null; mountType?: string | null; surface?: string | null; notes?: string | null;
  model?: Cam["model"] & { megapixels?: number | null; irRangeM?: number | null };
  photos?: { id: string; type: string; thumbPath: string | null; filePath: string; caption?: string | null; annotations?: string | null }[];
};

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ site: { id: string; name: string; clientName: string | null; address: string | null; notes: string | null; centerLat: number | null; centerLng: number | null; defaultZoom: number; cameras: CamX[]; infra: Infra[] }; branding: { companyName: string; logoPath: string | null; primaryColor: string; accentColor: string } | null } | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState<CamX | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`).then(async (r) => {
      if (!r.ok) setError(true);
      else setData(await r.json());
    }).catch(() => setError(true));
  }, [token]);

  if (error) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 text-center">
        <div className="text-lg font-semibold">Link unavailable</div>
        <div className="text-sm text-slate-400 mt-1">This share link is invalid, expired, or revoked.</div>
      </div>
    </main>
  );
  if (!data) return <main className="min-h-screen flex items-center justify-center text-slate-500 font-mono text-sm">LOADING…</main>;

  const { site, branding } = data;
  const center: [number, number] = [site.centerLng ?? site.cameras[0]?.lng ?? -98.5, site.centerLat ?? site.cameras[0]?.lat ?? 39.8];

  return (
    <div className="h-screen flex flex-col" style={{ ["--brand" as string]: branding?.primaryColor, ["--accent" as string]: branding?.accentColor }}>
      <header className="glass border-b border-edge px-4 py-2.5 flex items-center gap-3 z-20">
        {branding?.logoPath && <img src={`/api/uploads/${branding.logoPath}`} alt="" className="h-7 w-auto object-contain" />}
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{site.name}</div>
          {branding?.companyName && <div className="text-[10px] font-mono text-slate-500 truncate">{branding.companyName}</div>}
        </div>
        <div className="flex-1" />
        <a href={`/api/share/${token}/export`} target="_blank"
          className="bg-brand/20 border border-brand/50 text-brand rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-brand/30 transition">PDF REPORT</a>
      </header>
      <div className="flex-1 relative">
        <SiteMap center={center} zoom={site.centerLat ? site.defaultZoom : 15}
          cameras={site.cameras} infra={site.infra} mode="view" selectedId={sel?.id}
          onSelect={(kind, id) => setSel(kind === "camera" ? site.cameras.find((c) => c.id === id) ?? null : null)} />

        {sel && (
          <aside className="absolute z-10 glass overflow-y-auto sm:top-3 sm:right-3 sm:bottom-3 sm:w-96 sm:rounded-xl inset-x-0 bottom-0 max-h-[60vh] rounded-t-2xl">
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{sel.name}</div>
                  {sel.model && <div className="text-xs font-mono text-brand">{sel.model.name} · {sel.model.family.toUpperCase()}</div>}
                </div>
                <button onClick={() => setSel(null)} className="text-slate-500 hover:text-slate-200">✕</button>
              </div>
              {sel.model && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[["HFOV", `${sel.fovDeg ?? sel.model.hfovDeg}°`], ["RANGE", `${sel.rangeM ?? sel.model.effectiveRangeM}m`],
                    ["MP", sel.model.megapixels ? `${sel.model.megapixels}` : "—"]].map(([k, v]) => (
                    <div key={k} className="bg-ink border border-edge rounded-lg py-2">
                      <div className="text-[9px] font-mono text-slate-500">{k}</div>
                      <div className="text-sm font-bold text-brand">{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {(sel.mountType || sel.mountHeightM || sel.surface) && (
                <div className="text-xs text-slate-400">
                  Mount: {[sel.mountType, sel.mountHeightM ? `${sel.mountHeightM}m` : null, sel.surface].filter(Boolean).join(" · ")}
                </div>
              )}
              {sel.notes && <div className="text-xs text-slate-400">{sel.notes}</div>}
              <div className="space-y-2">
                {sel.photos?.map((p) => (
                  <figure key={p.id} className="border border-edge rounded-lg p-2">
                    <PhotoView photoUrl={`/api/uploads/${p.filePath}`} annotations={p.annotations} />
                    <figcaption className="text-[10px] font-mono text-slate-500 mt-1">
                      {p.type.toUpperCase()}{p.caption ? ` — ${p.caption}` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
