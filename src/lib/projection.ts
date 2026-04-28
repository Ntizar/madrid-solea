import proj4 from 'proj4';

// EPSG:25830 (ETRS89 / UTM zona 30N) → WGS84 (lng, lat)
proj4.defs(
  'EPSG:25830',
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);
const fwd = proj4('EPSG:25830', 'EPSG:4326');

export function utm25830ToWgs84(x: number, y: number): [number, number] {
  return fwd.forward([x, y]) as [number, number];
}

// Conversión rápida lng/lat ↔ metros locales para raycast plano (Madrid ~40.4°N).
const MADRID_LAT_RAD = (40.4168 * Math.PI) / 180;
export const M_PER_DEG_LAT = 111_320;
export const M_PER_DEG_LNG = 111_320 * Math.cos(MADRID_LAT_RAD);

export function llToLocalMeters(
  lng: number, lat: number, originLng: number, originLat: number
): [number, number] {
  return [(lng - originLng) * M_PER_DEG_LNG, (lat - originLat) * M_PER_DEG_LAT];
}

export function localMetersToLL(
  ex: number, ny: number, originLng: number, originLat: number
): [number, number] {
  return [originLng + ex / M_PER_DEG_LNG, originLat + ny / M_PER_DEG_LAT];
}
