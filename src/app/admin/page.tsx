"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Model } from "@/components/CameraPanel";

type Settings = { companyName: string; logoPath: string | null; primaryColor: string; accentColor: string; pdfFooterText: string; contactInfo: string };

export default function AdminPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const [editModel, setEditModel] = useState<Model | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [st, md] = await Promise.all([fetch("/api/settings").then((r) => r.json()), fetch("/api/models").then((r) => r.json())]);
    setS(st); setModels(md);
  }
  useEffect(() => { load(); }, []);

  async function save(p: Partial<Settings>) {
    const res = await api("/api/settings", { method: "PATCH", json: p });
    if (res?.ok) setS(await res.json());
    flash("Saved");
  }
  async function uploadLogo(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
    if (res.ok) load();
  }
  async function saveModel(m: Partial<Model> & { id?: string }) {
    if (m.id) await api(`/api/models/${m.id}`, { method: "PATCH", json: m });
    else await api("/api/models", { json: { ...m, family: m.family ?? "dome", hfovDeg: m.hfovDeg ?? 100, effectiveRangeM: m.effectiveRangeM ?? 20 } });
    setEditModel(null); load();
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/auth/password", { json: pw });
    flash(res?.ok ? "Password changed" : ((await res?.json().catch(() => ({})))?.error ?? "Failed"));
    setPw({ current: "", next: "" });
  }
  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  if (!s) return <main className="min-h-screen flex items-center justify-center text-slate-500 font-mono text-sm">LOADING…</main>;

  return (
    <main className="min-h-screen max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-slate-500 text-xs hover:text-brand">← SITES</Link>
          <h1 className="text-xl font-bold"><span className="text-brand">Field</span>View Admin</h1>
        </div>
        {msg && <span className="text-xs font-mono text-brand">{msg}</span>}
      </header>

      {/* Branding */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-mono text-slate-400">BRANDING & PDF EXPORT</h2>
        <div className="flex items-center gap-4">
          {s.logoPath ? <img src={`/api/uploads/${s.logoPath}`} alt="logo" className="h-12 w-auto object-contain bg-white/5 rounded p-1" />
            : <div className="h-12 w-24 border border-dashed border-edge rounded flex items-center justify-center text-[10px] text-slate-500">NO LOGO</div>}
          <button onClick={() => logoRef.current?.click()} className="text-xs border border-edge rounded px-3 py-1.5 hover:border-brand/50">UPLOAD LOGO</button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs">Company name
            <input defaultValue={s.companyName} onBlur={(e) => save({ companyName: e.target.value })}
              className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" /></label>
          <label className="text-xs">Contact info (PDF header)
            <input defaultValue={s.contactInfo} onBlur={(e) => save({ contactInfo: e.target.value })}
              className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" /></label>
          <label className="text-xs">Primary color
            <input type="color" value={s.primaryColor} onChange={(e) => save({ primaryColor: e.target.value })}
              className="w-full h-9 mt-1 bg-ink border border-edge rounded cursor-pointer" /></label>
          <label className="text-xs">Accent color
            <input type="color" value={s.accentColor} onChange={(e) => save({ accentColor: e.target.value })}
              className="w-full h-9 mt-1 bg-ink border border-edge rounded cursor-pointer" /></label>
        </div>
        <label className="text-xs block">PDF footer text
          <input defaultValue={s.pdfFooterText} onBlur={(e) => save({ pdfFooterText: e.target.value })}
            className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" /></label>
      </section>

      {/* Camera catalog */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono text-slate-400">CAMERA CATALOG ({models.length})</h2>
          <button onClick={() => setEditModel({ id: "", name: "", family: "dome", lensCount: 1, hfovDeg: 100, effectiveRangeM: 20, megapixels: null, irRangeM: null })}
            className="text-xs bg-brand/20 border border-brand/50 text-brand rounded px-3 py-1.5 font-semibold">+ MODEL</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500 font-mono text-[10px]">
              <th className="py-1.5 pr-2">MODEL</th><th className="pr-2">FAMILY</th><th className="pr-2">LENSES</th>
              <th className="pr-2">HFOV°</th><th className="pr-2">RANGE m</th><th className="pr-2">MP</th><th className="pr-2">IR m</th><th></th>
            </tr></thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t border-edge/50">
                  <td className="py-1.5 pr-2 font-semibold">{m.name}</td>
                  <td className="pr-2">{m.family}</td><td className="pr-2">{m.lensCount}</td>
                  <td className="pr-2">{m.hfovDeg}</td><td className="pr-2">{m.effectiveRangeM}</td>
                  <td className="pr-2">{m.megapixels ?? "—"}</td><td className="pr-2">{m.irRangeM ?? "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => setEditModel(m)} className="text-brand font-mono mr-2">EDIT</button>
                    <button onClick={async () => { if (confirm(`Delete ${m.name}?`)) { await api(`/api/models/${m.id}`, { method: "DELETE" }); load(); } }}
                      className="text-red-400 font-mono">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Password */}
      <section className="glass rounded-xl p-5">
        <h2 className="text-sm font-mono text-slate-400 mb-3">ADMIN PASSWORD</h2>
        <form onSubmit={changePw} className="flex gap-2 flex-wrap">
          <input type="password" placeholder="Current" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })}
            className="bg-ink border border-edge rounded px-2 py-1.5 text-xs w-40" />
          <input type="password" placeholder="New (8+ chars)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })}
            className="bg-ink border border-edge rounded px-2 py-1.5 text-xs w-40" />
          <button className="bg-brand/20 border border-brand/50 text-brand rounded px-4 py-1.5 text-xs font-semibold">CHANGE</button>
        </form>
      </section>

      {/* Model edit modal */}
      {editModel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="glass rounded-xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-sm">{editModel.id ? "Edit" : "New"} camera model</h3>
            <input defaultValue={editModel.name} placeholder="Name" id="m-name" className="w-full bg-ink border border-edge rounded px-2 py-1.5 text-sm" />
            <select defaultValue={editModel.family} id="m-family" className="w-full bg-ink border border-edge rounded px-2 py-1.5 text-sm">
              {["dome", "bullet", "mini", "fisheye", "multisensor", "ptz"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] font-mono text-slate-500">LENSES<input id="m-lens" type="number" defaultValue={editModel.lensCount} className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-0.5 text-sm" /></label>
              <label className="text-[10px] font-mono text-slate-500">HFOV°<input id="m-hfov" type="number" defaultValue={editModel.hfovDeg} className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-0.5 text-sm" /></label>
              <label className="text-[10px] font-mono text-slate-500">RANGE<input id="m-range" type="number" defaultValue={editModel.effectiveRangeM} className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-0.5 text-sm" /></label>
              <label className="text-[10px] font-mono text-slate-500">MP<input id="m-mp" type="number" step="0.1" defaultValue={editModel.megapixels ?? ""} className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-0.5 text-sm" /></label>
              <label className="text-[10px] font-mono text-slate-500">IR m<input id="m-ir" type="number" defaultValue={editModel.irRangeM ?? ""} className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-0.5 text-sm" /></label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => {
                const g = (i: string) => (document.getElementById(i) as HTMLInputElement).value;
                saveModel({
                  id: editModel.id || undefined, name: g("m-name"),
                  family: g("m-family") as Model["family"], lensCount: +g("m-lens") || 1,
                  hfovDeg: +g("m-hfov") || 100, effectiveRangeM: +g("m-range") || 20,
                  megapixels: g("m-mp") ? +g("m-mp") : null, irRangeM: g("m-ir") ? +g("m-ir") : null,
                });
              }} className="bg-brand text-ink rounded px-4 py-1.5 text-sm font-bold">SAVE</button>
              <button onClick={() => setEditModel(null)} className="text-slate-400 text-sm px-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
