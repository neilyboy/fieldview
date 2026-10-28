"use client";

import Dexie, { type EntityTable } from "dexie";

export type QueuedItem = {
  id?: number;
  url: string;
  method: string;
  jsonBody?: string; // JSON.stringify'd body for non-file requests
  form?: { fields: Record<string, string>; files: { key: string; name: string; type: string; blob: Blob }[] };
  createdAt: number;
};

const db = new Dexie("fieldview") as Dexie & { queue: EntityTable<QueuedItem, "id"> };
db.version(1).stores({ queue: "++id, createdAt" });

let flushing = false;
const listeners = new Set<(n: number) => void>();

export function onQueueCount(fn: (n: number) => void) {
  listeners.add(fn);
  db.queue.count().then(fn);
  return () => listeners.delete(fn);
}
function notify() {
  db.queue.count().then((n) => listeners.forEach((fn) => fn(n)));
}

export async function enqueue(item: Omit<QueuedItem, "createdAt">) {
  await db.queue.add({ ...item, createdAt: Date.now() });
  notify();
}

export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let done = 0;
  try {
    const items = await db.queue.orderBy("createdAt").toArray();
    for (const it of items) {
      try {
        let res: Response;
        if (it.form) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(it.form.fields)) fd.append(k, v);
          for (const f of it.form.files) fd.append(f.key, f.blob, f.name);
          res = await fetch(it.url, { method: it.method, body: fd });
        } else {
          res = await fetch(it.url, {
            method: it.method,
            headers: { "Content-Type": "application/json" },
            body: it.jsonBody,
          });
        }
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          // drop on success OR permanent client error (don't retry forever)
          await db.queue.delete(it.id!);
          done++;
        } else break; // server error — retry later
      } catch {
        break; // still offline
      }
    }
  } finally {
    flushing = false;
    notify();
  }
  return done;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushQueue());
}
