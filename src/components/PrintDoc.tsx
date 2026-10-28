"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { conesForCamera } from "@/lib/geo";
import PhotoView from "@/components/PhotoView";

const ESRI_IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LBL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

type Cam = {
  id: string; name: string; lat: number; lng: number; bearingDeg: number;
  fovDeg: number | null; rangeM: number | null; headBearings: string | null;
  mountHeightM: number | null; mountType: string | null; surface: string | null; notes: string | null;
  model: { name: string; family: string; lensCount: number; hfovDeg: number; effectiveRangeM: number; megapixels: number | null; irRangeM: number | null; notes: string | null } | null;
  photos: { id: string; type: string; caption: string | null; filePath: string; annotations: string | null }[];
};
type Site = {
  name: string; clientName: string | null; address: string | null; notes: string | null;
  cameras: Cam[];
  infra: { id: string; type: string; title: string; description: string | null; photos: { id: string; filePath: string }[] }[];
};
type Branding = { companyName: string; logoPath: string | null; primaryColor: string; accentColor: string; pdfFooterText: string; contactInfo: string };

const FAMILY_COLORS: Record<string, string> = {
  dome: "#22d3ee", bullet: "#4ade80", mini: "#a78bfa", fisheye: "#f472b6", multisensor: "#f59e0b", ptz: "#ef4444",
};

// Renders a maplibre map, rasterizes it to <img> once idle (prints reliably in PDFs).
function PrintMap(props: { cameras: Cam[]; focus?: Cam; height: string; onReady: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const cams = props.cameras;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          esri: { type: "raster", tiles: [ESRI_IMG], tileSize: 256 },
          labels: { type: "raster", tiles: [ESRI_LBL], tileSize: 256 },
          cones: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "esri", type: "raster", source: "esri" },
          { id: "cf", type: "fill", source: "cones", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.22 } },
          { id: "cl", type: "line", source: "cones", paint: { "line-color": ["get", "color"], "line-width": 1.5 } },
          { id: "labels", type: "raster", source: "labels" },
        ],
      },
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    const finish = () => {
      if (done.current) return;
      done.current = true;
      setTimeout(() => {
        setImg(map.getCanvas().toDataURL("image/jpeg", 0.9));
        props.onReady();
        map.remove();
      }, 400);
    };
    map.on("load", () => {
      const feats = cams.flatMap((c) =>
        conesForCamera(c).map((f) => ({ ...f, properties: { ...f.properties, color: FAMILY_COLORS[c.model?.family ?? "dome"] } }))
      );
      (map.getSource("cones") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
      for (const c of cams) {
        const el = document.createElement("div");
        el.style.cssText = `width:22px;height:22px;border-radius:50%;background:#0a0f14;border:2px solid ${FAMILY_COLORS[c.model?.family ?? "dome"]};color:${FAMILY_COLORS[c.model?.family ?? "dome"]};font:700 10px monospace;display:flex;align-items:center;justify-content:center`;
        el.textContent = String(cams.indexOf(c) + 1);
        new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map);
      }
      const pts = props.focus ? [props.focus] : cams;
      if (props.focus) {
        map.setCenter([props.focus.lng, props.focus.lat]);
        map.setZoom(17.8);
      } else if (pts.length) {
        const lngs = pts.map((c) => c.lng), lats = pts.map((c) => c.lat);
        map.fitBounds(
          [[Math.min(...lngs) - 0.0015, Math.min(...lats) - 0.001], [Math.max(...lngs) + 0.0015, Math.max(...lats) + 0.001]],
          { padding: 40, maxZoom: 18 }
        );
      } else {
        map.setCenter([-98.5, 39.8]); map.setZoom(4);
      }
      if (map.loaded()) finish(); else map.once("idle", finish);
    });
    setTimeout(finish, 20000); // hard timeout — never block PDF forever
    return () => { map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return img
    ? <img src={img} alt="map" className="w-full rounded-lg" style={{ height: props.height, objectFit: "cover" }} />
    : <div ref={ref} style={{ height: props.height, width: "100%", borderRadius: 8 }} />;
}

export default function PrintDoc({ site, branding }: { site: Site; branding: Branding }) {
  const mapsNeeded = 1 + site.cameras.length;
  const readyCount = useRef(0);
  const [, force] = useState(0);
  const onReady = () => {
    readyCount.current++;
    force((n) => n + 1);
    if (readyCount.current >= mapsNeeded) {
      // signal to puppeteer once images have had a moment to decode
      setTimeout(() => { (window as unknown as { __printReady?: boolean }).__printReady = true; }, 1200);
    }
  };
  useEffect(() => { if (!mapsNeeded) (window as unknown as { __printReady?: boolean }).__printReady = true; }, [mapsNeeded]);

  const pc = branding.primaryColor || "#22d3ee";
  const ac = branding.accentColor || "#f59e0b";
  const mounts = (c: Cam) => c.photos.filter((p) => p.type === "mount");
  const fovs = (c: Cam) => c.photos.filter((p) => p.type === "fov");
  const others = (c: Cam) => c.photos.filter((p) => p.type !== "mount" && p.type !== "fov");

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#0f172a", background: "#fff" }}>
      {/* COVER */}
      <div className="print-page" style={{ padding: "14mm 14mm 10mm", minHeight: "270mm", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${pc}`, paddingBottom: 12 }}>
          <div>
            {branding.logoPath && <img src={`/api/uploads/${branding.logoPath}`} alt="" style={{ height: 48, objectFit: "contain", marginBottom: 8 }} />}
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{site.name}</div>
            {site.clientName && <div style={{ fontSize: 14, color: "#475569" }}>Prepared for {site.clientName}</div>}
            {site.address && <div style={{ fontSize: 12, color: "#64748b" }}>{site.address}</div>}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
            {branding.companyName && <div style={{ fontWeight: 700, color: "#0f172a" }}>{branding.companyName}</div>}
            {branding.contactInfo && <div>{branding.contactInfo}</div>}
            <div>{new Date().toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ margin: "6mm 0", flex: 1 }}>
          <PrintMap cameras={site.cameras} height="170mm" onReady={onReady} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[["CAMERAS", site.cameras.length], ["LOCATIONS", site.infra.length], ["MODELS", new Set(site.cameras.map((c) => c.model?.name).filter(Boolean)).size]].map(([k, v]) => (
            <div key={k} style={{ flex: 1, border: "1px solid #e2e8f0", borderLeft: `3px solid ${ac}`, borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: pc }}>{v}</div>
            </div>
          ))}
        </div>
        {site.notes && <div style={{ marginTop: "5mm", fontSize: 12, color: "#475569" }}>{site.notes}</div>}
      </div>

      {/* PER-CAMERA PAGES */}
      {site.cameras.map((c, i) => (
        <div key={c.id} className="print-page" style={{ padding: "12mm 14mm", minHeight: "270mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${pc}`, paddingBottom: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#0a0f14", color: FAMILY_COLORS[c.model?.family ?? "dome"], border: `2px solid ${FAMILY_COLORS[c.model?.family ?? "dome"]}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, fontFamily: "monospace" }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                  {c.model?.name ?? "UNSPECIFIED"}{c.model ? ` · ${c.model.family.toUpperCase()}` : ""}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{site.name}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", marginBottom: 4 }}>LOCATION</div>
              <PrintMap cameras={site.cameras} focus={c} height="62mm" onReady={onReady} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", marginBottom: 4 }}>SPECIFICATION</div>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Model", c.model?.name ?? "—"], ["Family", c.model?.family ?? "—"],
                    ["Lenses", c.model?.lensCount ?? 1],
                    ["Field of view", `${c.fovDeg ?? c.model?.hfovDeg ?? "—"}°`],
                    ["Effective range", `${c.rangeM ?? c.model?.effectiveRangeM ?? "—"}m`],
                    ["Resolution", c.model?.megapixels ? `${c.model.megapixels} MP` : "—"],
                    ["IR range", c.model?.irRangeM ? `${c.model.irRangeM}m` : "—"],
                    ["Aim bearing", `${Math.round(c.bearingDeg)}°`],
                    ["Mount", [c.mountType, c.mountHeightM ? `${c.mountHeightM}m` : null, c.surface].filter(Boolean).join(" · ") || "—"],
                  ].map(([k, v]) => (
                    <tr key={k as string}>
                      <td style={{ padding: "4px 6px", color: "#64748b", borderBottom: "1px solid #f1f5f9", width: "40%" }}>{k}</td>
                      <td style={{ padding: "4px 6px", fontWeight: 600, borderBottom: "1px solid #f1f5f9" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", marginBottom: 4 }}>MOUNTING SURFACE</div>
              {mounts(c).length ? mounts(c).slice(0, 2).map((p) => (
                <div key={p.id} style={{ marginBottom: 6 }}>
                  <PhotoView photoUrl={`/api/uploads/${p.filePath}`} annotations={p.annotations} />
                  {p.caption && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{p.caption}</div>}
                </div>
              )) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, height: "55mm", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>No photo</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", marginBottom: 4 }}>EXPECTED FIELD OF VIEW</div>
              {fovs(c).length ? fovs(c).slice(0, 2).map((p) => (
                <div key={p.id} style={{ marginBottom: 6 }}>
                  <PhotoView photoUrl={`/api/uploads/${p.filePath}`} annotations={p.annotations} />
                  {p.caption && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{p.caption}</div>}
                </div>
              )) : <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, height: "55mm", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>No photo</div>}
            </div>
          </div>

          {others(c).length > 0 && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {others(c).slice(0, 3).map((p) => <PhotoView key={p.id} photoUrl={`/api/uploads/${p.filePath}`} annotations={p.annotations} />)}
            </div>
          )}
          {c.notes && <div style={{ marginTop: 8, fontSize: 11, color: "#475569", borderLeft: `3px solid ${ac}`, paddingLeft: 8 }}>{c.notes}</div>}
        </div>
      ))}

      {/* INFRA / CABLING */}
      {site.infra.length > 0 && (
        <div className="print-page" style={{ padding: "12mm 14mm" }}>
          <div style={{ borderBottom: `2px solid ${pc}`, paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Cabling & Infrastructure</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{site.name}</div>
          </div>
          {site.infra.map((it) => (
            <div key={it.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{it.title}</div>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: ac, border: `1px solid ${ac}`, borderRadius: 4, padding: "1px 6px" }}>{it.type.toUpperCase()}</div>
              </div>
              {it.description && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{it.description}</div>}
              {it.photos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                  {it.photos.slice(0, 3).map((p) => <img key={p.id} src={`/api/uploads/${p.filePath}`} alt="" style={{ width: "100%", borderRadius: 6 }} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
