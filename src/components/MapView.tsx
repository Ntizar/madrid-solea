import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as pmtiles from 'pmtiles';
import { useAppStore } from '../store/useAppStore';
import type { Terraza } from '../lib/types';

const _w = window as any;
if (!_w.__solmad_pmtiles) {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  _w.__solmad_pmtiles = true;
}

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const MADRID_CENTER: [number, number] = [-3.7038, 40.4168];

// SVG → dataURL para el icono de sol amarillo (estilo "Soleo")
function makeSunIconDataURL() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE9A8"/>
      <stop offset="60%" stop-color="#F2A93C"/>
      <stop offset="100%" stop-color="#C9701B"/>
    </radialGradient>
  </defs>
  <g transform="translate(32 32)">
    ${Array.from({ length: 12 }).map((_, i) => {
      const a = (i * Math.PI) / 6;
      const x1 = Math.cos(a) * 14, y1 = Math.sin(a) * 14;
      const x2 = Math.cos(a) * 26, y2 = Math.sin(a) * 26;
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#F2A93C" stroke-width="4" stroke-linecap="round"/>`;
    }).join('')}
    <circle r="13" fill="url(#g)" stroke="#7a3a05" stroke-width="1.5"/>
  </g>
</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function makeShadowIconDataURL() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="8" fill="#1B2D44" stroke="#0E1B2C" stroke-width="2" opacity="0.85"/>
  <circle cx="16" cy="16" r="3" fill="#3A5573"/>
</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function buildGeoJSON(terrazas: Terraza[], quick: Uint8Array | null) {
  return {
    type: 'FeatureCollection',
    features: terrazas.map((t, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        id: t.id,
        name: t.name,
        sun: quick ? quick[i] : -1
      }
    }))
  } as GeoJSON.FeatureCollection;
}

async function loadIcon(map: Map, name: string, url: string) {
  if (map.hasImage(name)) return;
  const img = await map.loadImage(url);
  if (img && !map.hasImage(name)) map.addImage(name, img.data, { pixelRatio: 2 });
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const terrazas = useAppStore((s) => s.terrazas);
  const quickSun = useAppStore((s) => s.quickSun);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedId = useAppStore((s) => s.setSelectedId);
  const setHoveredId = useAppStore((s) => s.setHoveredId);

  const fc = useMemo(() => buildGeoJSON(terrazas, quickSun), [terrazas, quickSun]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: MADRID_CENTER,
      zoom: 14.5,
      pitch: 50,
      bearing: -17,
      antialias: true,
      attributionControl: { compact: true }
    });
    mapRef.current = map;
    (window as any).__solmad_map = map;
    map.touchZoomRotate.enableRotation();

    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.warn('[map]', e.error?.message ?? e);
    });

    map.on('load', async () => {
      await Promise.all([
        loadIcon(map, 'solmad-sun', makeSunIconDataURL()),
        loadIcon(map, 'solmad-shadow', makeShadowIconDataURL())
      ]);

      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find((l) => l.type === 'symbol');
      const sources = map.getStyle().sources ?? {};

      if (sources.openmaptiles && !map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['zoom'],
                14, '#e6dccd',
                17, '#d8c8b1'
              ],
              'fill-extrusion-height': [
                'case',
                ['has', 'render_height'], ['get', 'render_height'],
                ['has', 'height'], ['get', 'height'],
                17
              ],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85
            }
          },
          labelLayer?.id
        );
      }

      map.addSource('terrazas', { type: 'geojson', data: fc });

      // Terrazas en SOMBRA: punto azul oscuro discreto
      map.addLayer({
        id: 'terrazas-shadow',
        type: 'circle',
        source: 'terrazas',
        filter: ['!=', ['get', 'sun'], 1],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 2.5,
            15, 4,
            18, 7
          ],
          'circle-color': '#1B2D44',
          'circle-stroke-color': '#0E1B2C',
          'circle-stroke-width': 1,
          'circle-opacity': 0.7
        }
      });

      // Terrazas con SOL: icono de sol amarillo (siempre visible)
      map.addLayer({
        id: 'terrazas-sun',
        type: 'symbol',
        source: 'terrazas',
        filter: ['==', ['get', 'sun'], 1],
        layout: {
          'icon-image': 'solmad-sun',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            12, 0.32,
            15, 0.5,
            18, 0.85
          ]
        }
      });

      // Hit area: punto invisible más grande para tap móvil sobre las soleadas
      map.addLayer({
        id: 'terrazas-hit',
        type: 'circle',
        source: 'terrazas',
        paint: {
          'circle-radius': 18,
          'circle-color': '#000',
          'circle-opacity': 0
        }
      });

      const handlePick = (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedId(Number(f.properties!.id));
      };
      map.on('click', 'terrazas-hit', handlePick);
      map.on('click', 'terrazas-sun', handlePick);
      map.on('click', 'terrazas-shadow', handlePick);

      map.on('mouseenter', 'terrazas-hit', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f) setHoveredId(Number(f.properties!.id));
      });
      map.on('mouseleave', 'terrazas-hit', () => {
        map.getCanvas().style.cursor = '';
        setHoveredId(null);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [setSelectedId, setHoveredId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('terrazas') as GeoJSONSource | undefined;
      if (src) src.setData(fc);
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [fc]);

  // Pequeño hint del cielo según hora (color del fondo del mapa, sutil)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const h = selectedDate.getHours() + selectedDate.getMinutes() / 60;
      let bg = '#EDE6D6';
      if (h < 6) bg = '#1B2D44';
      else if (h < 8) bg = '#E5C8A8';
      else if (h < 11) bg = '#F0EAD6';
      else if (h < 17) bg = '#EDE6D6';
      else if (h < 20) bg = '#F0C593';
      else if (h < 22) bg = '#5C5371';
      else bg = '#1B2D44';
      if (map.getLayer('background')) {
        try { map.setPaintProperty('background', 'background-color', bg); } catch {}
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [selectedDate]);

  return <div ref={ref} className="absolute inset-0" aria-label="Mapa de Madrid" />;
}

export function flyToTerraza(t: Terraza) {
  const w = window as any;
  if (w.__solmad_map) {
    w.__solmad_map.flyTo({ center: [t.lng, t.lat], zoom: 17.2, pitch: 55, bearing: -20, speed: 0.9, curve: 1.6 });
  }
}
