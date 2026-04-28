import type { BuildingPoly } from './types';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const DEFAULT_HEIGHT_M = 17; // ≈ 5 plantas, fallback Madrid centro
const LEVEL_HEIGHT_M = 3.2;
const CACHE_KEY = 'solmad:buildings:v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface CacheEntry { ts: number; bbox: [number, number, number, number]; data: BuildingPoly[]; }

function readCache(bbox: [number, number, number, number]): BuildingPoly[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    if (!sameBbox(entry.bbox, bbox)) return null;
    return entry.data;
  } catch { return null; }
}

function sameBbox(a: number[], b: number[]) {
  return a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
}

function writeCache(bbox: [number, number, number, number], data: BuildingPoly[]) {
  try {
    const entry: CacheEntry = { ts: Date.now(), bbox, data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota: ignorar */ }
}

function parseHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return DEFAULT_HEIGHT_M;
  if (tags.height) {
    const n = parseFloat(tags.height);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (Number.isFinite(lv) && lv > 0) return lv * LEVEL_HEIGHT_M;
  }
  return DEFAULT_HEIGHT_M;
}

/** bbox = [south, west, north, east] */
export async function fetchBuildings(
  bbox: [number, number, number, number]
): Promise<BuildingPoly[]> {
  const cached = readCache(bbox);
  if (cached) return cached;

  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:30];(way["building"](${s},${w},${n},${e}););out body geom;`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q)
  });
  if (!res.ok) throw new Error('Overpass error ' + res.status);
  const json = await res.json();
  const out: BuildingPoly[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry) continue;
    const ring = el.geometry.map((p: any) => [p.lon, p.lat]) as [number, number][];
    if (ring.length < 3) continue;
    out.push({ ring, height: parseHeight(el.tags) });
  }
  writeCache(bbox, out);
  return out;
}
