// Lee el JSON crudo del Ayuntamiento (en la raíz del repo), limpia, filtra y
// reproyecta de EPSG:25830 a WGS84. Escribe app/public/terrazas.min.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const SRC_CANDIDATES = [
  resolve(ROOT, '209548-796-censo-locales-historico.json'),
  resolve(__dirname, '..', 'data', 'terrazas.json')
];
const OUT = resolve(__dirname, '..', 'public', 'terrazas.min.json');

const SRC = SRC_CANDIDATES.find(existsSync);
if (!SRC) {
  console.error('[prepare-data] No encuentro el JSON. Coloca 209548-796-censo-locales-historico.json en la raíz del repo.');
  process.exit(1);
}

proj4.defs(
  'EPSG:25830',
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);
const fwd = proj4('EPSG:25830', 'EPSG:4326');

const trim = (s) => (typeof s === 'string' ? s.trim() : s);

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const out = [];
let skipped = 0;

for (const r of raw) {
  if (trim(r.desc_situacion_local) !== 'Abierto') { skipped++; continue; }
  if (trim(r.desc_situacion_terraza) && trim(r.desc_situacion_terraza) !== 'Abierta') { skipped++; continue; }
  const x = Number(r.coordenada_x_local);
  const y = Number(r.coordenada_y_local);
  if (!Number.isFinite(x) || !Number.isFinite(y)) { skipped++; continue; }
  const [lng, lat] = fwd.forward([x, y]);
  if (lat < 39 || lat > 41 || lng < -4.5 || lng > -3) { skipped++; continue; } // sanity Madrid

  out.push({
    id: r.id_terraza,
    localId: r.id_local,
    name: trim(r.rotulo) || 'Sin nombre',
    distrito: trim(r.desc_distrito_local),
    barrio: trim(r.desc_barrio_local),
    via: `${trim(r.clase_vial_edificio) || ''} ${trim(r.desc_vial_edificio) || ''}`.trim(),
    num: trim(r.num_edificio)?.replace(/^0+/, '') || '',
    cp: r.Cod_Postal,
    lng: +lng.toFixed(6),
    lat: +lat.toFixed(6),
    ubicacion: trim(r.desc_ubicacion_terraza) || null,
    horaIni: trim(r.hora_ini_LJ_es) || null,
    horaFin: trim(r.hora_fin_LJ_es) || null,
    mesas: r.mesas_es ?? r.mesas_ra ?? 0,
    sillas: r.sillas_es ?? r.sillas_ra ?? 0,
    superficie: r.Superficie_ES ?? r.Superficie_RA ?? null,
    sombrillas: (r.sombrillas_es ?? 0) + (r.sombrillas_pavimento_es ?? 0),
    periodo: trim(r.desc_periodo_terraza) || null
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`[prepare-data] ${out.length} terrazas abiertas (saltadas ${skipped}). → ${OUT}`);
