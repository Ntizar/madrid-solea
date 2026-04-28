import SunCalc from 'suncalc';

export interface SunVector {
  azimuthDeg: number; // 0=N, 90=E, 180=S, 270=W
  altitudeDeg: number;
}

// SunCalc devuelve azimut con 0 = sur, sentido horario. Lo pasamos a 0=N CW.
export function sunVector(date: Date, lat: number, lng: number): SunVector {
  const p = SunCalc.getPosition(date, lat, lng);
  const azFromSouth = (p.azimuth * 180) / Math.PI;
  const azimuthDeg = (azFromSouth + 180 + 360) % 360;
  const altitudeDeg = (p.altitude * 180) / Math.PI;
  return { azimuthDeg, altitudeDeg };
}

export function sunTimes(date: Date, lat: number, lng: number) {
  return SunCalc.getTimes(date, lat, lng);
}

// Vector horizontal unitario (este=+x, norte=+y) hacia el sol.
export function sunHorizDir(azimuthDeg: number): [number, number] {
  const a = (azimuthDeg * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
}
