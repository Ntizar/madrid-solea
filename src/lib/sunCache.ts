import type { SunState } from './types';

export interface CachedSunState extends SunState {
  id: number;
  key: string;
  updatedAt: string;
}

const LOCAL_KEY = 'solmad:sunCache:v1';

function readLocal(): Map<string, CachedSunState> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const rows = raw ? JSON.parse(raw) as CachedSunState[] : [];
    return new Map(rows.map((row) => [row.key, row]));
  } catch {
    return new Map();
  }
}

function writeLocal(map: Map<string, CachedSunState>) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...map.values()].slice(-1200)));
  } catch { /* ignore */ }
}

export function getLocalSunCache(key: string) {
  return readLocal().get(key) ?? null;
}

export function setLocalSunCache(row: CachedSunState) {
  const map = readLocal();
  map.set(row.key, row);
  writeLocal(map);
}

export async function fetchRemoteSunCache(keys: string[]) {
  if (keys.length === 0) return [];
  const res = await fetch(`/api/sun-cache?keys=${encodeURIComponent(keys.join(','))}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.rows) ? data.rows as CachedSunState[] : [];
}

export async function saveRemoteSunCache(rows: CachedSunState[]) {
  if (rows.length === 0) return;
  await fetch('/api/sun-cache', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows })
  }).catch(() => undefined);
}
