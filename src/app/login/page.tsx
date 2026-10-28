"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) router.push("/");
    else setError((await res.json()).error ?? "Login failed");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="glass rounded-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight"><span className="text-brand">Field</span>View</div>
          <div className="text-xs text-slate-400 mt-1 font-mono">SITE PLANNING // VERKADA</div>
        </div>
        <input className="w-full bg-ink border border-edge rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
          placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <input className="w-full bg-ink border border-edge rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
          type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button disabled={loading} className="w-full bg-brand/20 border border-brand/50 text-brand rounded-lg py-2.5 text-sm font-semibold hover:bg-brand/30 transition disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
