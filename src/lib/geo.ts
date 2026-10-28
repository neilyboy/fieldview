// Geographic math for FOV cone rendering (meters <-> lng/lat offsets).
export function destination(lat: number, lng: number, bearingDeg: number, distM: number): [number, number] {
  const R = 6378137;
  const brng = (bearingDeg * Math.PI) / 180;
  const d = distM / R;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

// Wedge polygon (camera apex + arc). Returns GeoJSON Position ring.
export function fovWedge(lat: number, lng: number, bearingDeg: number, fovDeg: number, rangeM: number, steps = 24): [number, number][] {
  const ring: [number, number][] = [[lng, lat]];
  const start = bearingDeg - fovDeg / 2;
  for (let i = 0; i <= steps; i++) {
    ring.push(destination(lat, lng, start + (fovDeg * i) / steps, rangeM));
  }
  ring.push([lng, lat]);
  return ring;
}

export function fovCircle(lat: number, lng: number, rangeM: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) ring.push(destination(lat, lng, (360 * i) / steps, rangeM));
  return ring;
}

export type ConeFeature = GeoJSON.Feature<GeoJSON.Polygon, { cameraId: string; family: string }>;

export function conesForCamera(cam: {
  id: string; lat: number; lng: number; bearingDeg: number;
  fovDeg?: number | null; rangeM?: number | null; headBearings?: string | null;
  model?: { family: string; hfovDeg: number; effectiveRangeM: number; lensCount: number } | null;
}): ConeFeature[] {
  const family = cam.model?.family ?? "dome";
  const fov = cam.fovDeg ?? cam.model?.hfovDeg ?? 100;
  const range = cam.rangeM ?? cam.model?.effectiveRangeM ?? 20;
  const mk = (ring: [number, number][], family: string) =>
    ({ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ring] }, properties: { cameraId: cam.id, family } });

  if (family === "fisheye" || family === "ptz") {
    return [mk(fovCircle(cam.lat, cam.lng, range), family)];
  }
  let heads: number[] = [];
  if (cam.headBearings) {
    try { heads = JSON.parse(cam.headBearings); } catch { heads = []; }
  }
  if (!heads.length) heads = [cam.bearingDeg];
  return heads.map((b) => mk(fovWedge(cam.lat, cam.lng, b, Math.min(fov, 360), range), family));
}
