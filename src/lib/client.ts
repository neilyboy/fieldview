"use client";

import { enqueue } from "./offline";

// fetch wrapper: queues JSON mutations and multipart uploads when offline.
export async function api(url: string, opts: {
  method?: string;
  json?: unknown;
  formData?: FormData;
  queue?: boolean; // default true for mutating requests
} = {}): Promise<Response | null> {
  const method = opts.method ?? (opts.json || opts.formData ? "POST" : "GET");
  const queueable = opts.queue ?? method !== "GET";
  try {
    if (opts.formData) {
      const res = await fetch(url, { method, body: opts.formData });
      return res;
    }
    return await fetch(url, {
      method,
      headers: opts.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    });
  } catch (e) {
    if (!queueable) return null;
    if (opts.formData) {
      const fields: Record<string, string> = {};
      const files: { key: string; name: string; type: string; blob: Blob }[] = [];
      opts.formData.forEach((v, k) => {
        if (typeof v === "object" && "arrayBuffer" in v && "name" in v && (v as File).size > 0) files.push({ key: k, name: v.name, type: v.type, blob: v });
        else fields[k] = String(v);
      });
      await enqueue({ url, method, form: { fields, files } });
    } else {
      await enqueue({ url, method, jsonBody: opts.json !== undefined ? JSON.stringify(opts.json) : undefined });
    }
    return null;
  }
}
