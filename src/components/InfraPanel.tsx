"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";

export type InfraFull = {
  id: string; type: string; title: string; description: string | null;
  lat: number | null; lng: number | null;
  photos: { id: string; filePath: string; thumbPath: string | null; caption: string | null; annotations: string | null; type: string }[];
};

const TYPES = [
  { v: "idf", label: "IDF / MDF" },
  { v: "switch", label: "Switch" },
  { v: "cablePath", label: "Cable path" },
  { v: "note", label: "Note" },
];

export default function InfraPanel(props: { item: InfraFull; onChanged: () => void; onDelete: () => void; onClose: () => void }) {
  const { item } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function patch(p: Partial<InfraFull>) {
    await api(`/api/infra/${item.id}`, { method: "PATCH", json: p });
    props.onChanged();
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    await api(`/api/infra/${item.id}/photos`, { formData: fd });
    setBusy(false);
    props.onChanged();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <input className="bg-transparent text-base font-semibold border-b border-transparent focus:border-brand outline-none flex-1 mr-2"
          defaultValue={item.title} onBlur={(e) => e.target.value !== item.title && patch({ title: e.target.value })} />
        <button onClick={props.onClose} className="text-slate-500 hover:text-slate-200">✕</button>
      </div>
      <div>
        <label className="text-[10px] font-mono text-slate-500">TYPE</label>
        <select value={item.type} onChange={(e) => patch({ type: e.target.value })}
          className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 mt-1">
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-mono text-slate-500">DESCRIPTION</label>
        <textarea rows={3} defaultValue={item.description ?? ""}
          onBlur={(e) => patch({ description: e.target.value || null })}
          className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-mono text-slate-500">PHOTOS ({item.photos.length})</label>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="bg-brand/20 border border-brand/50 text-brand rounded px-3 py-1 text-xs font-semibold">
            {busy ? "…" : "+ ADD"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </div>
        {item.photos.map((p) => (
          <div key={p.id} className="border border-edge rounded-lg p-2 mb-2">
            <img src={`/api/uploads/${p.thumbPath ?? p.filePath}`} alt="" className="w-full rounded" />
            <div className="flex justify-end mt-1">
              <button onClick={async () => { await api(`/api/photos/${p.id}`, { method: "DELETE" }); props.onChanged(); }}
                className="text-[10px] font-mono text-red-400">DELETE</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={props.onDelete} className="w-full text-red-400 border border-red-400/40 rounded-lg py-2 text-xs font-semibold hover:bg-red-400/10">
        DELETE ITEM
      </button>
    </div>
  );
}
