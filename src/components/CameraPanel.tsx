"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import Annotator from "./Annotator";
import PhotoView from "./PhotoView";

export type CamFull = {
  id: string; name: string; lat: number; lng: number; bearingDeg: number;
  fovDeg: number | null; rangeM: number | null; headBearings: string | null;
  mountHeightM: number | null; mountType: string | null; surface: string | null; notes: string | null;
  modelId: string | null;
  model: { id: string; name: string; family: string; lensCount: number; hfovDeg: number; effectiveRangeM: number; megapixels: number | null; irRangeM: number | null } | null;
  photos: { id: string; type: string; caption: string | null; filePath: string; thumbPath: string | null; annotations: string | null }[];
};
export type Model = NonNullable<CamFull["model"]>;

const PHOTO_TYPES = [
  { v: "mount", label: "Mount surface" },
  { v: "fov", label: "Field of view" },
  { v: "cablePath", label: "Cable path" },
  { v: "other", label: "Other" },
];
const MOUNT_TYPES = ["wall", "pole", "parapet", "pendant", "corner", "soffit", "roof"];

export default function CameraPanel(props: {
  cam: CamFull; models: Model[];
  onChanged: () => void;
  onLocalPatch: (id: string, patch: Partial<CamFull>) => void;
  onDelete: () => void;
  onClose: () => void;
  onRequestMove: () => void;
}) {
  const { cam } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState("mount");
  const [busy, setBusy] = useState(false);
  const [annotateId, setAnnotateId] = useState<string | null>(null);

  async function patch(p: Partial<CamFull>) {
    props.onLocalPatch(cam.id, p);
    await api(`/api/cameras/${cam.id}`, { method: "PATCH", json: p });
    props.onChanged();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    fd.append("type", uploadType);
    const res = await api(`/api/cameras/${cam.id}/photos`, { formData: fd });
    setBusy(false);
    if (!res) alert("Offline — photos queued for upload");
    props.onChanged();
  }

  async function deletePhoto(id: string) {
    await api(`/api/photos/${id}`, { method: "DELETE" });
    props.onChanged();
  }

  async function saveAnnotation(photoId: string, json: string) {
    await api(`/api/photos/${photoId}`, { method: "PATCH", json: { annotations: json } });
    setAnnotateId(null);
    props.onChanged();
  }

  async function useCompass() {
    const handler = (e: DeviceOrientationEvent) => {
      const heading = (e as { webkitCompassHeading?: number }).webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (heading != null) patch({ bearingDeg: Math.round(heading) });
      window.removeEventListener("deviceorientation", handler);
    };
    const DME = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (DME.requestPermission) {
      try { if ((await DME.requestPermission()) !== "granted") return; } catch { return; }
    }
    window.addEventListener("deviceorientation", handler);
    setTimeout(() => window.removeEventListener("deviceorientation", handler), 5000);
  }

  const isMulti = (cam.model?.lensCount ?? 1) > 1;
  const isRound = cam.model?.family === "fisheye" || cam.model?.family === "ptz";
  const heads: number[] = (() => { try { return cam.headBearings ? JSON.parse(cam.headBearings) : []; } catch { return []; } })();
  const annotatePhoto = cam.photos.find((p) => p.id === annotateId);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <input className="bg-transparent text-base font-semibold border-b border-transparent focus:border-brand outline-none flex-1 mr-2"
          value={cam.name} onChange={(e) => props.onLocalPatch(cam.id, { name: e.target.value })}
          onBlur={(e) => patch({ name: e.target.value })} />
        <button onClick={props.onClose} className="text-slate-500 hover:text-slate-200">✕</button>
      </div>

      {/* Model */}
      <div>
        <label className="text-[10px] font-mono text-slate-500">MODEL</label>
        <select value={cam.modelId ?? ""} onChange={(e) => patch({ modelId: e.target.value || null })}
          className="w-full bg-ink border border-edge rounded-lg px-2 py-1.5 mt-1">
          <option value="">— Unspecified —</option>
          {props.models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.family})</option>)}
        </select>
        {cam.model && (
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {cam.model.hfovDeg}° HFOV · {cam.model.effectiveRangeM}m range
            {cam.model.megapixels ? ` · ${cam.model.megapixels}MP` : ""}
            {cam.model.irRangeM ? ` · IR ${cam.model.irRangeM}m` : ""}
          </div>
        )}
      </div>

      {/* Aim */}
      {!isRound && (
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-slate-500">AIM {isMulti ? "— HEAD 1" : "BEARING"}</label>
            <span className="text-xs font-mono text-brand">{Math.round(cam.bearingDeg)}°</span>
          </div>
          <input type="range" min={0} max={359} value={cam.bearingDeg}
            onChange={(e) => props.onLocalPatch(cam.id, { bearingDeg: +e.target.value })}
            onMouseUp={(e) => patch({ bearingDeg: +(e.target as HTMLInputElement).value })}
            onTouchEnd={(e) => patch({ bearingDeg: +(e.target as HTMLInputElement).value })}
            className="w-full accent-cyan-400" />
          <div className="flex gap-2">
            <button onClick={useCompass} className="text-[11px] font-mono text-accent border border-accent/40 rounded px-2 py-1">USE COMPASS</button>
            <button onClick={props.onRequestMove} className="text-[11px] font-mono text-brand border border-brand/40 rounded px-2 py-1">MOVE ON MAP</button>
          </div>
        </div>
      )}

      {/* Multisensor heads */}
      {isMulti && (
        <div>
          <label className="text-[10px] font-mono text-slate-500">HEAD BEARINGS ({cam.model!.lensCount})</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {Array.from({ length: cam.model!.lensCount }).map((_, i) => (
              <input key={i} type="number" min={0} max={359}
                value={heads[i] ?? Math.round(cam.bearingDeg + (360 / cam.model!.lensCount) * i) % 360}
                onChange={(e) => {
                  const next = [...heads];
                  while (next.length < cam.model!.lensCount) next.push(Math.round(cam.bearingDeg + (360 / cam.model!.lensCount) * next.length) % 360);
                  next[i] = +e.target.value;
                  patch({ headBearings: JSON.stringify(next) });
                }}
                className="w-16 bg-ink border border-edge rounded px-2 py-1 text-center font-mono" />
            ))}
          </div>
        </div>
      )}

      {/* Cone overrides */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-slate-500">FOV ° (ovr)</label>
          <input type="number" placeholder={String(cam.model?.hfovDeg ?? 100)} value={cam.fovDeg ?? ""}
            onChange={(e) => patch({ fovDeg: e.target.value ? +e.target.value : null })}
            className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-500">RANGE m (ovr)</label>
          <input type="number" placeholder={String(cam.model?.effectiveRangeM ?? 20)} value={cam.rangeM ?? ""}
            onChange={(e) => patch({ rangeM: e.target.value ? +e.target.value : null })}
            className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
        </div>
      </div>

      {/* Mount */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-mono text-slate-500">MOUNT</label>
          <select value={cam.mountType ?? ""} onChange={(e) => patch({ mountType: e.target.value || null })}
            className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1">
            <option value="">—</option>
            {MOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-500">HEIGHT m</label>
          <input type="number" step="0.1" value={cam.mountHeightM ?? ""}
            onChange={(e) => patch({ mountHeightM: e.target.value ? +e.target.value : null })}
            className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-500">SURFACE</label>
          <input value={cam.surface ?? ""} onChange={(e) => patch({ surface: e.target.value || null })}
            placeholder="brick, metal…" className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
        </div>
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] font-mono text-slate-500 flex-1">PHOTOS ({cam.photos.length})</label>
          <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}
            className="bg-ink border border-edge rounded px-2 py-1 text-xs">
            {PHOTO_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="bg-brand/20 border border-brand/50 text-brand rounded px-3 py-1 text-xs font-semibold">
            {busy ? "…" : "+ ADD"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="space-y-3">
          {cam.photos.map((p) => (
            <div key={p.id} className="border border-edge rounded-lg p-2">
              <PhotoView photoUrl={`/api/uploads/${p.filePath}`} annotations={p.annotations} />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink border border-edge text-slate-400">{p.type.toUpperCase()}</span>
                <input defaultValue={p.caption ?? ""} placeholder="caption"
                  onBlur={(e) => e.target.value !== (p.caption ?? "") && api(`/api/photos/${p.id}`, { method: "PATCH", json: { caption: e.target.value } })}
                  className="flex-1 bg-transparent text-xs border-b border-transparent focus:border-edge outline-none" />
                <button onClick={() => setAnnotateId(p.id)} className="text-[10px] font-mono text-accent" title="Annotate">✎</button>
                <button onClick={() => deletePhoto(p.id)} className="text-[10px] font-mono text-red-400" title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-mono text-slate-500">NOTES</label>
        <textarea rows={2} defaultValue={cam.notes ?? ""}
          onBlur={(e) => patch({ notes: e.target.value || null })}
          className="w-full bg-ink border border-edge rounded px-2 py-1.5 mt-1" />
      </div>

      <button onClick={props.onDelete} className="w-full text-red-400 border border-red-400/40 rounded-lg py-2 text-xs font-semibold hover:bg-red-400/10">
        DELETE CAMERA
      </button>

      {annotatePhoto && (
        <Annotator
          photoUrl={`/api/uploads/${annotatePhoto.filePath}`}
          initial={annotatePhoto.annotations}
          onSave={(json) => saveAnnotation(annotatePhoto.id, json)}
          onClose={() => setAnnotateId(null)}
        />
      )}
    </div>
  );
}
