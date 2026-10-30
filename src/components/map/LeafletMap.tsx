"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { conesForCamera, destination } from "@/lib/geo";
import { bearingBetween, familyColor, type Cam, type Infra } from "./SiteMap";

const ESRI_IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LBL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// WebGL-free 2D fallback implementing the same props as SiteMap.
export default function LeafletMap(props: {
  center: [number, number]; zoom: number;
  cameras: Cam[]; infra: Infra[];
  mode: "edit" | "view";
  addMode?: "camera" | "infra" | "move" | null;
  selectedId?: string | null;
  zoomThumbs?: boolean;
  onSelect?: (kind: "camera" | "infra", id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onCameraMove?: (id: string, lat: number, lng: number) => void;
  onCameraBearing?: (id: string, deg: number) => void;
  onMyLocation?: (fn: () => { lat: number; lng: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const conesRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const infraRef = useRef<Map<string, L.Marker>>(new Map());
  const rotateRef = useRef<L.Marker | null>(null);
  const gpsRef = useRef<L.Marker | null>(null);
  const gpsPos = useRef<{ lat: number; lng: number } | null>(null);
  const esriRef = useRef<L.TileLayer | null>(null);
  const osmRef = useRef<L.TileLayer | null>(null);
  const lblRef = useRef<L.TileLayer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const syncCones = useCallback(() => {
    const g = conesRef.current;
    if (!g) return;
    g.clearLayers();
    for (const c of propsRef.current.cameras) {
      const color = familyColor(c);
      for (const f of conesForCamera(c)) {
        const ring = f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(ring, { color, weight: 1.5, opacity: 0.85, fillColor: color, fillOpacity: 0.22, interactive: false }).addTo(g);
      }
    }
  }, []);

  function markerIcon(cam: Cam, index: number): L.DivIcon {
    const sel = propsRef.current.selectedId === cam.id;
    const color = familyColor(cam);
    const fov = cam.photos?.find((p) => p.type === "fov");
    const zoom = mapRef.current?.getZoom() ?? 0;
    const showThumb = fov && zoom >= (propsRef.current.zoomThumbs === false ? 99 : 16.5);
    const html = `<div style="pointer-events:none" class="cam-marker${sel ? " selected" : ""}" style="border-color:${color};color:${color}"><span>${index + 1}</span>${
      showThumb ? `<img class="thumb" src="/api/uploads/${fov!.thumbPath ?? fov!.filePath}"/>` : ""
    }</div>`;
    return L.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  function refreshMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    propsRef.current.cameras.forEach((cam, i) => {
      seen.add(cam.id);
      let m = markersRef.current.get(cam.id);
      const icon = markerIcon(cam, i);
      if (!m) {
        m = L.marker([cam.lat, cam.lng], { icon, interactive: false }).addTo(map);
        markersRef.current.set(cam.id, m);
      } else {
        m.setLatLng([cam.lat, cam.lng]).setIcon(icon);
      }
    });
    for (const [id, m] of markersRef.current) if (!seen.has(id)) { m.remove(); markersRef.current.delete(id); }
  }

  function refreshInfra() {
    const map = mapRef.current;
    if (!map) return;
    const icons: Record<string, string> = { idf: "⌂", switch: "⎇", cablePath: "⌁", note: "✎" };
    const seen = new Set<string>();
    for (const it of propsRef.current.infra) {
      if (it.lat == null || it.lng == null) continue;
      seen.add(it.id);
      let m = infraRef.current.get(it.id);
      const icon = L.divIcon({ html: `<div class="infra-marker">${icons[it.type] ?? "•"}</div>`, className: "", iconSize: [26, 26], iconAnchor: [13, 13] });
      if (!m) {
        m = L.marker([it.lat, it.lng], { icon, interactive: false }).addTo(map);
        infraRef.current.set(it.id, m);
      } else m.setLatLng([it.lat, it.lng]).setIcon(icon);
    }
    for (const [id, m] of infraRef.current) if (!seen.has(id)) { m.remove(); infraRef.current.delete(id); }
  }

  function refreshRotate() {
    const map = mapRef.current;
    if (!map) return;
    const sel = propsRef.current.cameras.find((c) => c.id === propsRef.current.selectedId);
    const family = sel?.model?.family;
    if (!sel || propsRef.current.mode !== "edit" || family === "fisheye" || family === "ptz" ||
        (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches)) {
      rotateRef.current?.remove(); rotateRef.current = null;
      return;
    }
    const range = (sel.rangeM ?? sel.model?.effectiveRangeM ?? 20) * 0.9;
    const [hlng, hlat] = destination(sel.lat, sel.lng, sel.bearingDeg, Math.max(range, 8));
    const icon = L.divIcon({ html: `<div class="rotate-handle"></div>`, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
    if (!rotateRef.current) {
      const m = L.marker([hlat, hlng], { icon, draggable: true }).addTo(map);
      m.on("drag", () => {
        const ll = m.getLatLng();
        const s = propsRef.current.cameras.find((c) => c.id === propsRef.current.selectedId);
        if (!s) return;
        propsRef.current.onCameraBearing?.(s.id, bearingBetween(s.lat, s.lng, ll.lat, ll.lng));
      });
      rotateRef.current = m;
    } else {
      rotateRef.current.setLatLng([hlat, hlng]).setIcon(icon);
    }
  }

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(
      [propsRef.current.center[1], propsRef.current.center[0]], propsRef.current.zoom
    );
    esriRef.current = L.tileLayer(ESRI_IMG, { maxNativeZoom: 19, maxZoom: 22, attribution: "Esri, Maxar, Earthstar Geographics" }).addTo(map);
    lblRef.current = L.tileLayer(ESRI_LBL, { maxNativeZoom: 19, maxZoom: 22, pane: "shadowPane" }).addTo(map);
    osmRef.current = L.tileLayer(OSM, { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
    conesRef.current = L.layerGroup().addTo(map);
    map.on("click", (e) => {
      const p = propsRef.current;
      if (p.addMode) { p.onMapClick?.(e.latlng.lat, e.latlng.lng); return; }
      let best: { kind: "camera" | "infra"; id: string; d: number } | null = null;
      for (const c of p.cameras) {
        const px = map.latLngToContainerPoint([c.lat, c.lng]);
        const d = Math.hypot(px.x - e.containerPoint.x, px.y - e.containerPoint.y);
        if (d < 30 && (!best || d < best.d)) best = { kind: "camera", id: c.id, d };
      }
      for (const it of p.infra) {
        if (it.lat == null || it.lng == null) continue;
        const px = map.latLngToContainerPoint([it.lat, it.lng]);
        const d = Math.hypot(px.x - e.containerPoint.x, px.y - e.containerPoint.y);
        if (d < 30 && (!best || d < best.d)) best = { kind: "infra", id: it.id, d };
      }
      if (best) p.onSelect?.(best.kind, best.id);
    });
    map.on("zoomend", refreshMarkers);
    mapRef.current = map;
    syncCones(); refreshMarkers(); refreshInfra(); refreshRotate();
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { syncCones(); refreshMarkers(); refreshInfra(); refreshRotate(); },
    [props.cameras, props.infra, props.selectedId, props.mode, props.zoomThumbs, syncCones]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition((pos) => {
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsPos.current = ll;
      const map = mapRef.current;
      if (!map) return;
      if (!gpsRef.current) {
        const icon = L.divIcon({ html: `<div class="gps-dot"></div>`, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
        gpsRef.current = L.marker([ll.lat, ll.lng], { icon, interactive: false }).addTo(map);
      } else gpsRef.current.setLatLng([ll.lat, ll.lng]);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
    props.onMyLocation?.(() => gpsPos.current);
    return () => navigator.geolocation.clearWatch(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBasemap() {
    const map = mapRef.current;
    if (!map || !osmRef.current || !esriRef.current || !lblRef.current) return;
    const osmOn = map.hasLayer(osmRef.current);
    if (osmOn) {
      map.removeLayer(osmRef.current); esriRef.current.addTo(map); lblRef.current.addTo(map);
    } else {
      map.removeLayer(esriRef.current); map.removeLayer(lblRef.current); osmRef.current.addTo(map);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="absolute inset-0" />
      <button onClick={toggleBasemap}
        className="absolute top-3 left-14 z-[600] glass rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-brand transition">
        AERIAL / STREETS
      </button>
      {props.addMode && (
        <div className="absolute top-14 left-3 z-[600] glass rounded-lg px-3 py-1.5 text-xs text-accent font-mono">
          {props.addMode === "move" ? "TAP MAP TO MOVE CAMERA" : `TAP MAP TO PLACE ${props.addMode === "camera" ? "CAMERA" : "INFRA"}`}
        </div>
      )}
    </div>
  );
}
