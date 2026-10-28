"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export type Share = { id: string; token: string; label: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string };

export default function SharePanel(props: { siteId: string; shares: Share[]; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("");

  function url(token: string) {
    return `${window.location.origin}/s/${token}`;
  }
  async function create() {
    const expiresAt = days ? new Date(Date.now() + +days * 864e5).toISOString() : null;
    await api(`/api/sites/${props.siteId}/shares`, { json: { label: label || null, expiresAt } });
    setLabel(""); setDays("");
    props.onChanged();
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="text-[10px] font-mono text-slate-500">CLIENT SHARE LINKS</div>
      <div className="flex gap-2">
        <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)}
          className="flex-1 bg-ink border border-edge rounded px-2 py-1.5 text-xs" />
        <input placeholder="Days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)}
          className="w-16 bg-ink border border-edge rounded px-2 py-1.5 text-xs" title="Expires in N days (blank = never)" />
        <button onClick={create} className="bg-brand/20 border border-brand/50 text-brand rounded px-3 py-1.5 text-xs font-semibold">+ LINK</button>
      </div>
      {props.shares.map((s) => {
        const dead = s.revokedAt || (s.expiresAt && new Date(s.expiresAt) < new Date());
        return (
          <div key={s.id} className={`border border-edge rounded-lg p-2.5 ${dead ? "opacity-40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{s.label || "Share link"}</span>
              <span className="text-[10px] font-mono text-slate-500">
                {s.revokedAt ? "REVOKED" : s.expiresAt ? `exp ${new Date(s.expiresAt).toLocaleDateString()}` : "no expiry"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input readOnly value={url(s.token)} onFocus={(e) => e.target.select()}
                className="flex-1 bg-ink border border-edge rounded px-2 py-1 text-[10px] font-mono text-slate-400" />
              <button onClick={() => navigator.clipboard.writeText(url(s.token))}
                className="text-[10px] font-mono text-brand border border-brand/40 rounded px-2 py-1">COPY</button>
              {!dead && (
                <button onClick={async () => { await api(`/api/shares/${s.id}`, { method: "PATCH", json: { revoked: true } }); props.onChanged(); }}
                  className="text-[10px] font-mono text-red-400 border border-red-400/40 rounded px-2 py-1">REVOKE</button>
              )}
            </div>
          </div>
        );
      })}
      {!props.shares.length && <div className="text-xs text-slate-500">No links yet — create one to share this site with your client.</div>}
    </div>
  );
}
