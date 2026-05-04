import type { BuildingPoly } from './types';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter'
];
const DEFAULT_HEIGHT_M = 10; // fallback prudente: evita sombras falsas en edificios sin altura OSM
const LEVEL_HEIGHT_M = 3.2;
const CACHE_KEY = 'solmad:buildings:v3';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const TILE_ROWS = 4;
const TILE_COLS = 4;
const TILE_CONCURRENCY = 2;

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

function splitBbox(bbox: [number, number, number, number]) {
  const [south, west, north, east] = bbox;
  const tiles: [number, number, number, number][] = [];
  const latStep = (north - south) / TILE_ROWS;
  const lngStep = (east - west) / TILE_COLS;
  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const s = south + row * latStep;
      const n = row === TILE_ROWS - 1 ? north : s + latStep;
      const w = west + col * lngStep;
      const e = col === TILE_COLS - 1 ? east : w + lngStep;
      tiles.push([s, w, n, e]);
    }
  }
  return tiles;
}

async function pool<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function parseElements(json: any, seen: Set<string>) {
  const out: BuildingPoly[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry) continue;
    const key = el.id ? `way:${el.id}` : JSON.stringify(el.geometry.slice(0, 3));
    if (seen.has(key)) continue;
    seen.add(key);
    const ring = el.geometry.map((p: any) => [p.lon, p.lat]) as [number, number][];
    if (ring.length < 3) continue;
    out.push({ ring, height: parseHeight(el.tags) });
  }
  return out;
}

async function postOverpass(endpoint: string, bbox: [number, number, number, number], timeoutSec = 25) {
  const [s, w, n, e] = bbox;
  const q = `[out:json][timeout:${timeoutSec}];(way["building"](${s},${w},${n},${e}););out body geom;`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q)
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} @ ${new URL(endpoint).host}`);
  return res.json();
}

async function fetchTile(bbox: [number, number, number, number], seen: Set<string>) {
  let lastError: unknown = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const json = await postOverpass(endpoint, bbox);
      return parseElements(json, seen);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  console.warn('[solmad] Tile de edificios omitido:', lastError);
  return [];
}

/** bbox = [south, west, north, east] */
export async function fetchBuildings(
  bbox: [number, number, number, number]
): Promise<BuildingPoly[]> {
  const cached = readCache(bbox);
  if (cached) return cached;

  const seen = new Set<string>();
  const chunks = await pool(splitBbox(bbox), TILE_CONCURRENCY, (tile) => fetchTile(tile, seen));
  const out = chunks.flat();
  if (out.length === 0) throw new Error('Overpass no devolvió edificios');
  writeCache(bbox, out);
  return out;
}
