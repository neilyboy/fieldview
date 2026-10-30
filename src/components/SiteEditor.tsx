"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteMap from "./map/SiteMap";
import CameraPanel, { type CamFull, type Model } from "./CameraPanel";
import InfraPanel, { type InfraFull } from "./InfraPanel";
import SharePanel, { type Share } from "./SharePanel";
import { api } from "@/lib/client";
import { onQueueCount, flushQueue } from "@/lib/offline";

type Site = {
  id: string; name: string; clientName: string | null; address: string | null; notes: string | null;
  centerLat: number | null; centerLng: number | null; defaultZoom: number;
  cameras: CamFull[]; infra: InfraFull[]; shares: Share[];
};

export default function SiteEditor({ initialSite, models }: { initialSite: Site; models: Model[] }) {
  const [site, setSite] = useState(initialSite);
  const [selected, setSelected] = useState<{ kind: "camera" | "infra"; id: string } | null>(null);
  const [addMode, setAddMode] = useState<"camera" | "infra" | "move" | null>(null);
  const [pending, setPending] = useState(0);
  const [panel, setPanel] = useState<"detail" | "list" | "share" | "closed">("list");
  const myLoc = useRef<() => { lat: number; lng: number } | null>(() => null);
  const bearingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  async function refresh() {
    const res = await api(`/api/sites/${site.id}`, { queue: false });
    if (res?.ok) setSite(await res.json());
  }
  useEffect(() => {
    // start with the panel tucked away on phones — the ☰ button opens it
    if (window.matchMedia("(max-width: 639px)").matches && !window.matchMedia("(pointer: fine)").matches) setPanel("closed");
    const off = onQueueCount(setPending);
    const t = setInterval(async () => { if (await flushQueue()) refresh(); }, 15000);
    return () => { off(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function localPatch(id: string, p: Partial<CamFull>) {
    setSite((s) => ({ ...s, cameras: s.cameras.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  }

  async function createCamera(lat: number, lng: number) {
    const n = site.cameras.length + 1;
    const res = await api(`/api/sites/${site.id}/cameras`, {
      json: { name: `Camera ${n}`, lat, lng, bearingDeg: 0 },
    });
    if (!res) { alert("Offline — camera queued"); refresh(); return; }
    const cam = await res.json();
    await refresh();
    setSelected({ kind: "camera", id: cam.id });
    setPanel("detail");
  }

  async function createInfra(lat: number, lng: number) {
    const res = await api(`/api/sites/${site.id}/infra`, {
      json: { type: "note", title: `Item ${site.infra.length + 1}`, lat, lng },
    });
    if (!res) { alert("Offline — item queued"); return; }
    const item = await res.json();
    await refresh();
    setSelected({ kind: "infra", id: item.id });
    setPanel("detail");
  }

  const selCam = selected?.kind === "camera" ? site.cameras.find((c) => c.id === selected.id) : null;
  const selInfra = selected?.kind === "infra" ? site.infra.find((i) => i.id === selected.id) : null;

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* top bar */}
      <header className="glass border-b border-edge px-3 py-2 flex items-center gap-2 z-20">
        <Link href="/" className="text-slate-400 hover:text-brand text-sm px-1">←</Link>
        <input defaultValue={site.name}
          onBlur={(e) => e.target.value !== site.name && api(`/api/sites/${site.id}`, { method: "PATCH", json: { name: e.target.value } })}
          className="bg-transparent font-semibold text-sm border-b border-transparent focus:border-brand outline-none min-w-0 flex-1 sm:flex-none sm:w-56" />
        {pending > 0 && (
          <span className="text-[10px] font-mono text-accent border border-accent/40 rounded px-2 py-0.5 whitespace-nowrap">
            {pending} QUEUED
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => setPanel(panel === "share" ? "list" : "share")}
          className="glass rounded-lg px-3 py-1.5 text-xs font-semibold hover:text-brand transition">SHARE</button>
        <a href={`/api/sites/${site.id}/export`} target="_blank"
          className="bg-accent/20 border border-accent/50 text-accent rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-accent/30 transition">PDF</a>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <SiteMap
          center={[site.centerLng ?? -98.5, site.centerLat ?? 39.8]}
          zoom={site.centerLat ? site.defaultZoom : 4}
          cameras={site.cameras}
          infra={site.infra}
          mode="edit"
          addMode={addMode}
          selectedId={selected?.id}
          onSelect={(kind, id) => { setSelected({ kind, id }); setPanel("detail"); setAddMode(null); }}
          onMapClick={async (lat, lng) => {
            if (addMode === "camera") createCamera(lat, lng);
            else if (addMode === "infra") createInfra(lat, lng);
            else if (addMode === "move" && selected?.kind === "camera") {
              localPatch(selected.id, { lat, lng });
              await api(`/api/cameras/${selected.id}`, { method: "PATCH", json: { lat, lng } });
            }
            setAddMode(null);
          }}
          onCameraMove={async (id, lat, lng) => {
            localPatch(id, { lat, lng });
            await api(`/api/cameras/${id}`, { method: "PATCH", json: { lat, lng } });
          }}
          onCameraBearing={(id, deg) => {
            localPatch(id, { bearingDeg: Math.round(deg) });
            const timers = bearingTimers.current;
            clearTimeout(timers.get(id));
            timers.set(id, setTimeout(() => api(`/api/cameras/${id}`, { method: "PATCH", json: { bearingDeg: Math.round(deg) } }), 600));
          }}
          onMyLocation={(fn) => (myLoc.current = fn)}
        />

        {/* action bar */}
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-10 flex gap-1.5 px-2 max-w-full">
          <button
            onClick={() => { const p = myLoc.current(); if (p) createCamera(p.lat, p.lng); else alert("GPS not available yet — allow location access"); }}
            className="glass rounded-full px-3 py-2 text-[11px] font-bold text-brand border-brand/40 hover:bg-brand/10 transition whitespace-nowrap">
            ◉ AT ME
          </button>
          <button onClick={() => setAddMode(addMode === "camera" ? null : "camera")}
            className={`glass rounded-full px-3 py-2 text-[11px] font-bold transition whitespace-nowrap ${addMode === "camera" ? "text-accent border-accent/50" : "text-slate-300"}`}>
            ＋ MAP
          </button>
          <button onClick={() => setAddMode(addMode === "infra" ? null : "infra")}
            className={`glass rounded-full px-3 py-2 text-[11px] font-bold transition whitespace-nowrap ${addMode === "infra" ? "text-accent border-accent/50" : "text-slate-300"}`}>
            ⌂ INFRA
          </button>
          <button onClick={() => setPanel(panel === "closed" ? "list" : "closed")}
            className="glass rounded-full px-3 py-2 text-[11px] font-bold text-slate-300 whitespace-nowrap">☰</button>
        </div>

        {/* side / bottom panel */}
        <aside className={`absolute z-10 glass overflow-y-auto
          sm:top-3 sm:right-3 sm:bottom-3 sm:w-80 sm:rounded-xl sm:translate-y-0
          inset-x-0 bottom-14 max-h-[50dvh] rounded-t-2xl transition-transform duration-200
          ${panel === "closed" ? "max-sm:translate-y-[110%]" : ""}`}>
          <div className="p-4">
            {panel === "share" ? (
              <SharePanel siteId={site.id} shares={site.shares} onChanged={refresh} />
            ) : selCam ? (
              <CameraPanel cam={selCam} models={models} onChanged={refresh} onLocalPatch={localPatch}
                onRequestMove={() => setAddMode("move")}
                onClose={() => { setSelected(null); setPanel("list"); }}
                onDelete={async () => {
                  if (!confirm(`Delete ${selCam.name}?`)) return;
                  await api(`/api/cameras/${selCam.id}`, { method: "DELETE" });
                  setSelected(null); setPanel("list"); refresh();
                }} />
            ) : selInfra ? (
              <InfraPanel item={selInfra} onChanged={refresh}
                onClose={() => { setSelected(null); setPanel("list"); }}
                onDelete={async () => {
                  if (!confirm(`Delete ${selInfra.title}?`)) return;
                  await api(`/api/infra/${selInfra.id}`, { method: "DELETE" });
                  setSelected(null); setPanel("list"); refresh();
                }} />
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] font-mono text-slate-500">CAMERAS ({site.cameras.length})</div>
                {site.cameras.map((c, i) => (
                  <button key={c.id} onClick={() => { setSelected({ kind: "camera", id: c.id }); setPanel("detail"); }}
                    className="w-full text-left border border-edge rounded-lg px-3 py-2 hover:border-brand/50 transition">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-ink border border-brand/50 text-brand text-[10px] font-mono flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-semibold flex-1 truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{c.model?.name ?? "—"}</span>
                    </div>
                  </button>
                ))}
                {!site.cameras.length && <div className="text-xs text-slate-500">No cameras — tap ◉ CAMERA AT ME or ＋ ON MAP.</div>}
                {!!site.infra.length && (
                  <>
                    <div className="text-[10px] font-mono text-slate-500 pt-2">INFRA ({site.infra.length})</div>
                    {site.infra.map((it) => (
                      <button key={it.id} onClick={() => { setSelected({ kind: "infra", id: it.id }); setPanel("detail"); }}
                        className="w-full text-left border border-edge rounded-lg px-3 py-2 text-sm hover:border-brand/50 transition">
                        {it.title} <span className="text-[10px] font-mono text-slate-500 ml-1">{it.type}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
