import * as Comlink from 'comlink';
import SunCalc from 'suncalc';
import type { BuildingPoly, SunState, Terraza } from '../lib/types';

const M_PER_DEG_LAT = 111_320;
const RAY_LEN_M = 250;
const STEP_MIN = 5;            // resolución para "minutos restantes"
const RIBBON_STEP_MIN = 30;    // resolución para el gráfico de ritmo (48 = 24h)

function mPerDegLng(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

interface Seg { ax: number; ay: number; bx: number; by: number; h: number; }

// Construye índice grid sobre los segmentos de los edificios para acelerar.
class SegIndex {
  cell = 60; // metros por celda
  grid = new Map<string, Seg[]>();
  originLng = 0; originLat = 0; mLng = 1;

  build(buildings: BuildingPoly[], originLng: number, originLat: number) {
    this.originLng = originLng; this.originLat = originLat;
    this.mLng = mPerDegLng(originLat);
    for (const b of buildings) {
      const r = b.ring;
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, ay] = this.toM(r[i][0], r[i][1]);
        const [bx, by] = this.toM(r[i + 1][0], r[i + 1][1]);
        const seg: Seg = { ax, ay, bx, by, h: b.height };
        this.indexSeg(seg);
      }
    }
  }
  toM(lng: number, lat: number): [number, number] {
    return [(lng - this.originLng) * this.mLng, (lat - this.originLat) * M_PER_DEG_LAT];
  }
  indexSeg(s: Seg) {
    const minX = Math.min(s.ax, s.bx), maxX = Math.max(s.ax, s.bx);
    const minY = Math.min(s.ay, s.by), maxY = Math.max(s.ay, s.by);
    const c = this.cell;
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++) {
      for (let cy = Math.floor(minY / c); cy <= Math.floor(maxY / c); cy++) {
        const k = cx + ',' + cy;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(s);
      }
    }
  }
  queryRay(ox: number, oy: number, dx: number, dy: number, len: number): Seg[] {
    const c = this.cell;
    const seen = new Set<Seg>();
    const steps = Math.ceil(len / (c * 0.5));
    for (let i = 0; i <= steps; i++) {
      const t = (i * len) / steps;
      const x = ox + dx * t, y = oy + dy * t;
      const cx = Math.floor(x / c), cy = Math.floor(y / c);
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        for (let ny = cy - 1; ny <= cy + 1; ny++) {
          const arr = this.grid.get(nx + ',' + ny);
          if (arr) for (const s of arr) seen.add(s);
        }
      }
    }
    return [...seen];
  }
}

let index: SegIndex | null = null;

function segIntersectRay(ox: number, oy: number, dx: number, dy: number, len: number, s: Seg): number | null {
  // ray: P = O + t*D, t in [0, len]
  // seg: Q = A + u*(B-A), u in [0,1]
  const r1x = dx, r1y = dy;
  const r2x = s.bx - s.ax, r2y = s.by - s.ay;
  const denom = r1x * r2y - r1y * r2x;
  if (Math.abs(denom) < 1e-9) return null;
  const sx = s.ax - ox, sy = s.ay - oy;
  const t = (sx * r2y - sy * r2x) / denom;
  const u = (sx * r1y - sy * r1x) / denom;
  if (t < 0 || t > len || u < 0 || u > 1) return null;
  return t;
}

function isSunlit(originX: number, originY: number, azDeg: number, altDeg: number): boolean {
  if (altDeg <= 0 || !index) return false;
  const a = (azDeg * Math.PI) / 180;
  const dx = Math.sin(a), dy = Math.cos(a);
  const tanAlt = Math.tan((altDeg * Math.PI) / 180);
  const segs = index.queryRay(originX, originY, dx, dy, RAY_LEN_M);
  for (const s of segs) {
    const t = segIntersectRay(originX, originY, dx, dy, RAY_LEN_M, s);
    if (t === null) continue;
    const rayH = t * tanAlt; // altura del rayo a esa distancia
    if (s.h > rayH + 0.5) return false; // bloquea con margen
  }
  return true;
}

const api = {
  setBuildings(buildings: BuildingPoly[], originLng: number, originLat: number) {
    index = new SegIndex();
    index.build(buildings, originLng, originLat);
    return { segments: [...index.grid.values()].reduce((a, b) => a + b.length, 0) };
  },

  computeFor(terrazas: Terraza[], whenIso: string): SunState[] {
    if (!index) throw new Error('Buildings not loaded');
    const when = new Date(whenIso);
    const results: SunState[] = new Array(terrazas.length);

    // sunset común aproximado (cogemos el de la primera terraza, Madrid es pequeño)
    const ref = terrazas[0];
    const times = SunCalc.getTimes(when, ref.lat, ref.lng);
    const sunset = times.sunset;

    for (let i = 0; i < terrazas.length; i++) {
      const t = terrazas[i];
      const [ox, oy] = index.toM(t.lng, t.lat);

      // Estado ahora
      const pNow = SunCalc.getPosition(when, t.lat, t.lng);
      const azNow = (((pNow.azimuth * 180) / Math.PI) + 180 + 360) % 360;
      const altNow = (pNow.altitude * 180) / Math.PI;
      const sunNow = isSunlit(ox, oy, azNow, altNow);

      // Minutos restantes (5 min steps hasta sunset)
      let minutesLeft = 0;
      if (sunset && when < sunset) {
        const end = sunset.getTime();
        for (let ts = when.getTime(); ts < end; ts += STEP_MIN * 60_000) {
          const d = new Date(ts);
          const p = SunCalc.getPosition(d, t.lat, t.lng);
          const az = (((p.azimuth * 180) / Math.PI) + 180 + 360) % 360;
          const al = (p.altitude * 180) / Math.PI;
          if (al > 0 && isSunlit(ox, oy, az, al)) minutesLeft += STEP_MIN;
        }
      }

      // Ribbon 48 medias horas del día actual
      const ribbon: number[] = new Array(48);
      const day = new Date(when); day.setHours(0, 0, 0, 0);
      for (let k = 0; k < 48; k++) {
        const d = new Date(day.getTime() + k * RIBBON_STEP_MIN * 60_000);
        const p = SunCalc.getPosition(d, t.lat, t.lng);
        const az = (((p.azimuth * 180) / Math.PI) + 180 + 360) % 360;
        const al = (p.altitude * 180) / Math.PI;
        if (al <= 0) ribbon[k] = 2; // noche
        else ribbon[k] = isSunlit(ox, oy, az, al) ? 1 : 0;
      }

      results[i] = {
        sunNow,
        altitudeDeg: altNow,
        azimuthDeg: azNow,
        minutesLeft,
        ribbon
      };
    }
    return results;
  },

  // Versión rápida: solo sunNow (para arrastrar el slider en tiempo real).
  quickFor(terrazas: Terraza[], whenIso: string): Uint8Array {
    if (!index) throw new Error('Buildings not loaded');
    const when = new Date(whenIso);
    const out = new Uint8Array(terrazas.length);
    for (let i = 0; i < terrazas.length; i++) {
      const t = terrazas[i];
      const [ox, oy] = index.toM(t.lng, t.lat);
      const p = SunCalc.getPosition(when, t.lat, t.lng);
      const az = (((p.azimuth * 180) / Math.PI) + 180 + 360) % 360;
      const al = (p.altitude * 180) / Math.PI;
      out[i] = al <= 0 ? 2 : isSunlit(ox, oy, az, al) ? 1 : 0;
    }
    return out;
  }
};

export type ShadowAPI = typeof api;
Comlink.expose(api);
