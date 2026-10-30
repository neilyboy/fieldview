"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { conesForCamera, destination } from "@/lib/geo";
import dynamic from "next/dynamic";
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

export type Cam = {
  id: string; name: string; lat: number; lng: number; bearingDeg: number;
  fovDeg?: number | null; rangeM?: number | null; headBearings?: string | null;
  model?: { family: string; hfovDeg: number; effectiveRangeM: number; lensCount: number; name: string } | null;
  photos?: { id: string; type: string; thumbPath: string | null; filePath: string; caption?: string | null; annotations?: string | null }[];
};
export type Infra = { id: string; title: string; type: string; lat: number | null; lng: number | null };

const ESRI_IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LBL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const FAMILY_COLORS: Record<string, string> = {
  dome: "#22d3ee", bullet: "#4ade80", mini: "#a78bfa",
  fisheye: "#f472b6", multisensor: "#f59e0b", ptz: "#ef4444",
};

export function familyColor(cam: Cam) {
  return FAMILY_COLORS[cam.model?.family ?? "dome"] ?? FAMILY_COLORS.dome;
}

export default function SiteMap(props: {
  center: [number, number]; zoom: number;
  cameras: Cam[]; infra: Infra[];
  mode: "edit" | "view";
  addMode?: "camera" | "infra" | null;
  selectedId?: string | null;
  zoomThumbs?: boolean;
  onSelect?: (kind: "camera" | "infra", id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onCameraMove?: (id: string, lat: number, lng: number) => void;
  onCameraBearing?: (id: string, deg: number) => void;
  onMyLocation?: (fn: () => { lat: number; lng: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const infraMarkersRef = useRef<Map<string, Marker>>(new Map());
  const rotateRef = useRef<Marker | null>(null);
  const gpsRef = useRef<Marker | null>(null);
  const gpsPos = useRef<{ lat: number; lng: number } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const syncCones = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource("cones") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features = propsRef.current.cameras.flatMap((c) =>
      conesForCamera(c).map((f) => ({ ...f, properties: { ...f.properties, color: familyColor(c) } }))
    );
    src.setData({ type: "FeatureCollection", features });
  }, []);

  // Init map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          esri: { type: "raster", tiles: [ESRI_IMG], tileSize: 256, attribution: "Esri, Maxar, Earthstar Geographics" },
          labels: { type: "raster", tiles: [ESRI_LBL], tileSize: 256 },
          osm: { type: "raster", tiles: [OSM], tileSize: 256, attribution: "© OpenStreetMap contributors" },
          cones: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "esri", type: "raster", source: "esri" },
          { id: "osm", type: "raster", source: "osm", layout: { visibility: "none" } },
          { id: "cones-fill", type: "fill", source: "cones",
            paint: { "fill-color": ["coalesce", ["get", "color"], "#22d3ee"], "fill-opacity": 0.22 } },
          { id: "cones-line", type: "line", source: "cones",
            paint: { "line-color": ["coalesce", ["get", "color"], "#22d3ee"], "line-width": 1.5, "line-opacity": 0.85 } },
          { id: "labels", type: "raster", source: "labels" },
        ],
      },
      center: propsRef.current.center,
      zoom: propsRef.current.zoom,
      maxZoom: 22,
      attributionControl: { compact: true },
      });
    } catch (e) {
      setGlError(e instanceof Error ? e.message : String(e));
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      syncCones();
      refreshMarkers();
      refreshInfra();
      refreshRotate();
      refreshThumbs();
    });
    map.on("click", (e) => {
      const p = propsRef.current;
      if (p.addMode && p.onMapClick) p.onMapClick(e.lngLat.lat, e.lngLat.lng);
    });
    map.on("zoom", refreshThumbs);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- imperative marker syncing ---
  function makeMarkerEl(cam: Cam, index: number) {
    const el = document.createElement("div");
    el.className = "cam-marker" + (propsRef.current.selectedId === cam.id ? " selected" : "");
    el.style.borderColor = familyColor(cam);
    el.style.color = familyColor(cam);
    el.innerHTML = `<span>${index + 1}</span>`;
    const fov = cam.photos?.find((p) => p.type === "fov");
    if (fov && (mapRef.current?.getZoom() ?? 0) >= (propsRef.current.zoomThumbs === false ? 99 : 16.5)) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = `/api/uploads/${fov.thumbPath ?? fov.filePath}`;
      el.appendChild(img);
    }
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      propsRef.current.onSelect?.("camera", cam.id);
    });
    return el;
  }

  function refreshMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    propsRef.current.cameras.forEach((cam, i) => {
      seen.add(cam.id);
      let m = markersRef.current.get(cam.id);
      if (!m) {
        m = new Marker({ element: makeMarkerEl(cam, i), draggable: propsRef.current.mode === "edit" })
          .setLngLat([cam.lng, cam.lat]).addTo(map);
        m.on("dragend", () => {
          const ll = m!.getLngLat();
          propsRef.current.onCameraMove?.(cam.id, ll.lat, ll.lng);
        });
        markersRef.current.set(cam.id, m);
      } else {
        m.setLngLat([cam.lng, cam.lat]);
        m.setDraggable(propsRef.current.mode === "edit");
        const el = m.getElement();
        const fresh = makeMarkerEl(cam, i);
        el.className = fresh.className;
        el.innerHTML = fresh.innerHTML;
      }
    });
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) { m.remove(); markersRef.current.delete(id); }
    }
  }

  function refreshInfra() {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const icons: Record<string, string> = { idf: "⌂", switch: "⎇", cablePath: "⌁", note: "✎" };
    for (const it of propsRef.current.infra) {
      if (it.lat == null || it.lng == null) continue;
      seen.add(it.id);
      let m = infraMarkersRef.current.get(it.id);
      if (!m) {
        const el = document.createElement("div");
        el.className = "infra-marker";
        el.textContent = icons[it.type] ?? "•";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          propsRef.current.onSelect?.("infra", it.id);
        });
        m = new Marker({ element: el }).setLngLat([it.lng, it.lat]).addTo(map);
        infraMarkersRef.current.set(it.id, m);
      } else m.setLngLat([it.lng, it.lat]);
    }
    for (const [id, m] of infraMarkersRef.current) {
      if (!seen.has(id)) { m.remove(); infraMarkersRef.current.delete(id); }
    }
  }

  function refreshRotate() {
    const map = mapRef.current;
    if (!map) return;
    const sel = propsRef.current.cameras.find((c) => c.id === propsRef.current.selectedId);
    const family = sel?.model?.family;
    if (!sel || propsRef.current.mode !== "edit" || family === "fisheye" || family === "ptz") {
      rotateRef.current?.remove(); rotateRef.current = null;
      return;
    }
    const range = (sel.rangeM ?? sel.model?.effectiveRangeM ?? 20) * 0.9;
    const [hlng, hlat] = destination(sel.lat, sel.lng, sel.bearingDeg, Math.max(range, 8));
    if (!rotateRef.current) {
      const el = document.createElement("div");
      el.className = "rotate-handle";
      const m = new Marker({ element: el, draggable: true }).setLngLat([hlng, hlat]).addTo(map);
      m.on("drag", () => {
        const ll = m.getLngLat();
        const s = propsRef.current.cameras.find((c) => c.id === propsRef.current.selectedId);
        if (!s) return;
        const deg = bearingBetween(s.lat, s.lng, ll.lat, ll.lng);
        propsRef.current.onCameraBearing?.(s.id, deg);
      });
      rotateRef.current = m;
    } else {
      rotateRef.current.setLngLat([hlng, hlat]);
    }
  }

  function refreshThumbs() {
    refreshMarkers(); // rebuild els cheaply; fine at site scale
  }

  // Re-sync on prop changes
  useEffect(() => { syncCones(); refreshMarkers(); refreshInfra(); refreshRotate(); },
    [props.cameras, props.infra, props.selectedId, props.mode, props.zoomThumbs, syncCones]);

  // GPS dot
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gpsPos.current = ll;
        const map = mapRef.current;
        if (!map) return;
        if (!gpsRef.current) {
          const el = document.createElement("div");
          el.className = "gps-dot";
          gpsRef.current = new Marker({ element: el }).setLngLat([ll.lng, ll.lat]).addTo(map);
        } else gpsRef.current.setLngLat([ll.lng, ll.lat]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    props.onMyLocation?.(() => gpsPos.current);
    return () => navigator.geolocation.clearWatch(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBasemap() {
    const map = mapRef.current;
    if (!map) return;
    const osmOn = map.getLayoutProperty("osm", "visibility") === "visible";
    map.setLayoutProperty("osm", "visibility", osmOn ? "none" : "visible");
    map.setLayoutProperty("esri", "visibility", osmOn ? "visible" : "none");
    map.setLayoutProperty("labels", "visibility", osmOn ? "visible" : "none");
  }

  return (
    <div className="relative w-full h-full">
      {!glError && <div ref={ref} className="absolute inset-0" />}
      {glError && (
        <>
          <LeafletMap {...propsRef.current} />
          <div className="absolute bottom-3 left-3 z-10 glass rounded-lg px-3 py-1.5 text-[10px] font-mono text-accent max-w-[70%]" title={glError}>
            2D FALLBACK MODE — WebGL unavailable, enable graphics acceleration for full map
          </div>
        </>
      )}
      {!glError && (
        <button
          onClick={toggleBasemap}
          className="absolute top-3 left-3 z-10 glass rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-brand transition"
          title="Toggle basemap"
        >AERIAL / STREETS</button>
      )}
      {props.addMode && (
        <div className="absolute top-14 left-3 z-10 glass rounded-lg px-3 py-1.5 text-xs text-accent font-mono">
          TAP MAP TO PLACE {props.addMode === "camera" ? "CAMERA" : "INFRA"}
        </div>
      )}
    </div>
  );
}

export function bearingBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
