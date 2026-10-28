"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "arrow" | "circle" | "rect" | "freehand" | "text" | "select";

// Photo annotation editor — fabric.js canvas over the photo.
// Saves JSON: { w, h, fabric: canvas.toJSON() }
export default function Annotator(props: {
  photoUrl: string;
  initial?: string | null;
  onSave: (json: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabRef = useRef<import("fabric").Canvas | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState("#f59e0b");
  const [fabric, setFabric] = useState<typeof import("fabric") | null>(null);
  const drawing = useRef<{ startX: number; startY: number; obj: import("fabric").FabricObject | null } | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const f = await import("fabric");
      if (disposed || !canvasRef.current) return;
      setFabric(f);
      const W = 900;
      const img = await f.FabricImage.fromURL(props.photoUrl, { crossOrigin: "anonymous" });
      const scale = W / (img.width ?? W);
      const H = Math.round((img.height ?? W) * scale);
      const cv = new f.Canvas(canvasRef.current, { width: W, height: H, selection: false });
      cv.backgroundImage = img;
      img.scale(scale);
      cv.renderAll();
      if (props.initial) {
        try {
          const parsed = JSON.parse(props.initial);
          await cv.loadFromJSON(parsed.fabric);
          cv.renderAll();
        } catch { /* ignore */ }
      }
      fabRef.current = cv;
    })();
    return () => { disposed = true; fabRef.current?.dispose(); fabRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cv = fabRef.current;
    if (!cv || !fabric) return;
    cv.isDrawingMode = tool === "freehand";
    cv.selection = tool === "select";
    cv.defaultCursor = tool === "select" ? "default" : "crosshair";
    if (cv.freeDrawingBrush) {
      cv.freeDrawingBrush.color = color;
      cv.freeDrawingBrush.width = 4;
    }
  }, [tool, color, fabric]);

  useEffect(() => {
    const cv = fabRef.current;
    if (!cv || !fabric) return;
    const onDown = (opt: import("fabric").TPointerEventInfo) => {
      if (tool === "select" || tool === "freehand") return;
      const p = opt.scenePoint;
      drawing.current = { startX: p.x, startY: p.y, obj: null };
      let obj: import("fabric").FabricObject | null = null;
      const common = { stroke: color, strokeWidth: 4, fill: "transparent", selectable: true };
      if (tool === "arrow") obj = new fabric.Line([p.x, p.y, p.x, p.y], common);
      if (tool === "circle") obj = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, ...common });
      if (tool === "rect") obj = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, ...common });
      if (tool === "text") {
        const t = new fabric.IText("label", { left: p.x, top: p.y, fill: color, fontSize: 32, fontFamily: "monospace" });
        obj = t; cv.add(t); cv.setActiveObject(t); t.enterEditing();
      }
      if (obj) { cv.add(obj); drawing.current!.obj = obj; }
    };
    const onMove = (opt: import("fabric").TPointerEventInfo) => {
      const d = drawing.current;
      if (!d?.obj) return;
      const p = opt.scenePoint;
      const o = d.obj as { set?: (k: Record<string, number>) => void };
      if (o.set) {
        if (d.obj.type === "line") o.set({ x2: p.x, y2: p.y });
        else if (d.obj.type === "ellipse") o.set({ rx: Math.abs(p.x - d.startX) / 2, ry: Math.abs(p.y - d.startY) / 2 });
        else if (d.obj.type === "rect") o.set({ width: Math.abs(p.x - d.startX), height: Math.abs(p.y - d.startY) });
      }
      cv.renderAll();
    };
    const onUp = () => {
      const d = drawing.current;
      if (d?.obj?.type === "line") {
        // add arrowhead
        const l = d.obj as import("fabric").Line;
        const angle = Math.atan2((l.y2 ?? 0) - (l.y1 ?? 0), (l.x2 ?? 0) - (l.x1 ?? 0));
        const head = new fabric.Triangle({
          left: l.x2, top: l.y2, width: 18, height: 18,
          fill: color, angle: (angle * 180) / Math.PI + 90, originX: "center", originY: "center",
        });
        cv.add(head);
      }
      drawing.current = null;
    };
    cv.on("mouse:down", onDown);
    cv.on("mouse:move", onMove);
    cv.on("mouse:up", onUp);
    return () => { cv.off("mouse:down", onDown); cv.off("mouse:move", onMove); cv.off("mouse:up", onUp); };
  }, [tool, color, fabric]);

  function undo() {
    const cv = fabRef.current;
    const objs = cv?.getObjects();
    if (cv && objs?.length) { cv.remove(objs[objs.length - 1]); cv.renderAll(); }
  }

  function save() {
    const cv = fabRef.current;
    if (!cv) return;
    props.onSave(JSON.stringify({ w: cv.width, h: cv.height, fabric: cv.toJSON() }));
  }

  const tools: { t: Tool; label: string }[] = [
    { t: "arrow", label: "→" }, { t: "circle", label: "◯" }, { t: "rect", label: "▭" },
    { t: "freehand", label: "✎" }, { t: "text", label: "T" }, { t: "select", label: "⬚" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="glass rounded-t-xl px-4 py-2 flex items-center gap-2 flex-wrap">
        {tools.map(({ t, label }) => (
          <button key={t} onClick={() => setTool(t)}
            className={`w-9 h-9 rounded-lg text-lg ${tool === t ? "bg-accent/30 text-accent border border-accent/50" : "bg-ink text-slate-300 border border-edge"}`}>
            {label}
          </button>
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-transparent" />
        <button onClick={undo} className="px-3 h-9 rounded-lg bg-ink border border-edge text-xs">UNDO</button>
        <button onClick={() => fabRef.current?.clear() || location.reload()} className="px-3 h-9 rounded-lg bg-ink border border-edge text-xs text-red-400">CLEAR</button>
      </div>
      <div className="max-w-[92vw] max-h-[70vh] overflow-auto bg-black rounded-b-xl border border-edge">
        <canvas ref={canvasRef} />
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={save} className="bg-brand text-ink rounded-lg px-6 py-2 text-sm font-bold">SAVE ANNOTATION</button>
        <button onClick={props.onClose} className="text-slate-400 text-sm px-4">Cancel</button>
      </div>
    </div>
  );
}
