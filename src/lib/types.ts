export interface Terraza {
  id: number;
  localId: number;
  name: string;
  distrito: string;
  barrio: string;
  via: string;
  num: string;
  cp: number;
  lng: number;
  lat: number;
  ubicacion: string | null;
  horaIni: string | null;
  horaFin: string | null;
  mesas: number;
  sillas: number;
  superficie: number | null;
  sombrillas: number;
  periodo: string | null;
}

export interface SunState {
  sunNow: boolean;          // sol directo ahora
  altitudeDeg: number;      // del sol en este momento
  azimuthDeg: number;       // 0 = N, 90 = E
  minutesLeft: number;      // minutos de sol restantes hoy en esta terraza
  ribbon: number[];         // 48 medias horas, 0=sombra,1=sol,2=noche
}

export interface BuildingPoly {
  // anillo exterior en lng/lat, ya en WGS84
  ring: [number, number][];
  height: number; // metros
}
