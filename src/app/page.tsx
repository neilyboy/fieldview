"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SiteRow = { id: string; name: string; clientName: string | null; address: string | null; updatedAt: string; _count: { cameras: number; shares: number } };

export default function Dashboard() {
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", clientName: "", address: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/sites").then((r) => r.json()).then(setSites).catch(() => setSites([]));
  }, []);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Geocode address (best-effort) so the map opens in the right place
    let center: { centerLat?: number; centerLng?: number } = {};
    if (form.address) {
      try {
        const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(form.address)}`).then((r) => r.json());
        if (g[0]) center = { centerLat: +g[0].lat, centerLng: +g[0].lon };
      } catch { /* offline or rate-limited — fine */ }
    }
    const res = await fetch("/api/sites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, ...center, defaultZoom: 18 }),
    });
    setBusy(false);
    if (res.ok) {
      const site = await res.json();
      router.push(`/sites/${site.id}`);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight"><span className="text-brand">Field</span>View</h1>
          <div className="text-[11px] text-slate-500 font-mono">SITE PLANNING // VERKADA</div>
        </div>
        <nav className="flex gap-2">
          <Link href="/admin" className="glass rounded-lg px-3 py-2 text-xs font-semibold hover:text-brand transition">ADMIN</Link>
          <button onClick={logout} className="glass rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-red-400 transition">LOGOUT</button>
        </nav>
      </header>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono text-slate-400">SITES</h2>
        <button onClick={() => setShowNew(true)} className="bg-brand/20 border border-brand/50 text-brand rounded-lg px-4 py-2 text-sm font-semibold hover:bg-brand/30 transition">
          + NEW SITE
        </button>
      </div>

      {showNew && (
        <form onSubmit={createSite} className="glass rounded-xl p-5 mb-6 space-y-3">
          <input required placeholder="Site name (e.g. Sunrise Towers PHA)" className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Client / organization" className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
            value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          <input placeholder="Address (used to center the map)" className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea placeholder="Notes" rows={2} className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button disabled={busy} className="bg-brand text-ink rounded-lg px-4 py-2 text-sm font-bold">{busy ? "Creating…" : "Create site"}</button>
            <button type="button" onClick={() => setShowNew(false)} className="text-slate-400 text-sm px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {sites?.map((s) => (
          <Link key={s.id} href={`/sites/${s.id}`} className="glass rounded-xl p-5 hover:border-brand/50 transition group">
            <div className="font-semibold group-hover:text-brand transition">{s.name}</div>
            {s.clientName && <div className="text-sm text-slate-400">{s.clientName}</div>}
            {s.address && <div className="text-xs text-slate-500 mt-1 truncate">{s.address}</div>}
            <div className="flex gap-3 mt-3 text-[11px] font-mono text-slate-500">
              <span><span className="text-brand">{s._count.cameras}</span> CAMERAS</span>
              <span><span className="text-accent">{s._count.shares}</span> LINKS</span>
            </div>
          </Link>
        ))}
        {sites && !sites.length && !showNew && (
          <div className="glass rounded-xl p-8 text-center text-slate-500 text-sm sm:col-span-2">
            No sites yet — create your first site to start planning.
          </div>
        )}
      </div>
    </main>
  );
}
