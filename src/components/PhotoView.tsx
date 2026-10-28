"use client";

import { useEffect, useRef } from "react";

// Read-only renderer: photo + stored fabric annotation overlay.
export default function PhotoView(props: { photoUrl: string; annotations?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    if (!props.annotations) return;
    (async () => {
      try {
        const parsed = JSON.parse(props.annotations!);
        const f = await import("fabric");
        if (disposed || !canvasRef.current) return;
        const cv = new f.StaticCanvas(canvasRef.current, { width: parsed.w, height: parsed.h });
        const img = await f.FabricImage.fromURL(props.photoUrl, { crossOrigin: "anonymous" });
        cv.backgroundImage = img;
        img.scale(parsed.w / (img.width ?? parsed.w));
        await cv.loadFromJSON(parsed.fabric);
        cv.renderAll();
      } catch { /* ignore */ }
    })();
    return () => { disposed = true; };
  }, [props.photoUrl, props.annotations]);

  if (!props.annotations) {
    return <img src={props.photoUrl} alt="" className={props.className ?? "w-full rounded-lg"} />;
  }
  return (
    <div ref={ref} className={props.className ?? "w-full"}>
      <canvas ref={canvasRef} className="w-full rounded-lg" />
    </div>
  );
}
