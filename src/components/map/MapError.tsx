"use client";

export default function MapError({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 z-20 bg-ink flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-6 max-w-md space-y-4">
        <div>
          <div className="text-lg font-bold text-accent">Map unavailable — WebGL failed</div>
          <div className="text-xs text-slate-400 mt-1">
            FieldView's map engine needs WebGL, which your browser couldn't initialize.
          </div>
        </div>
        <div className="text-sm space-y-2 text-slate-300">
          <div className="font-mono text-[10px] text-slate-500">TRY THESE IN ORDER:</div>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Open <code className="text-brand">chrome://settings/system</code> and enable <b>"Use graphics acceleration"</b>, then restart the browser.</li>
            <li>If it's already on, open <code className="text-brand">chrome://flags/#ignore-gpu-blocklist</code>, set it to <b>Enabled</b>, restart.</li>
            <li>Check <code className="text-brand">chrome://gpu</code> — "WebGL" should say <i>Hardware accelerated</i> or <i>Software only</i> (both work; "Disabled" doesn't).</li>
            <li>On this Ubuntu box you can also try launching Chrome with <code className="text-brand">--use-gl=angle</code>.</li>
          </ol>
        </div>
        <details className="text-[10px] font-mono text-slate-600">
          <summary className="cursor-pointer">technical details</summary>
          <div className="mt-1 break-all">{error}</div>
        </details>
        <button onClick={() => location.reload()} className="w-full bg-brand/20 border border-brand/50 text-brand rounded-lg py-2 text-sm font-semibold">
          RELOAD
        </button>
      </div>
    </div>
  );
}
