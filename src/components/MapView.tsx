import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAppStore } from '../store/useAppStore';
import type { Terraza } from '../lib/types';

const MADRID_CENTER: [number, number] = [-3.7038, 40.4168];

// Estilo raster ligero y muy fiable (CARTO Positron). No depende de pmtiles ni
// vector tiles que han fallado en cargas anteriores → el mapa se ve siempre.
const RASTER_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19
    }
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#EDE6D6' } },
    { id: 'carto', type: 'raster', source: 'carto-light' }
  ]
};

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
  const setSelectedId = useAppStore((s) => s.setSelectedId);
  const setHoveredId = useAppStore((s) => s.setHoveredId);
  const userLocation = useAppStore((s) => s.userLocation);

  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const fc = useMemo(() => buildGeoJSON(terrazas, quickSun), [terrazas, quickSun]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let map: Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: RASTER_STYLE,
        center: MADRID_CENTER,
        zoom: 13.5,
        pitch: 0,
        bearing: 0,
        antialias: true,
        attributionControl: { compact: true }
      });
    } catch (err: any) {
      setMapError(err?.message ?? 'No se pudo iniciar el mapa');
      return;
    }
    mapRef.current = map;
    (window as any).__solmad_map = map;

    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.warn('[map]', e.error?.message ?? e);
    });

    const markLoaded = () => setTilesLoaded(true);
    map.once('idle', markLoaded);
    map.once('load', markLoaded);

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right');

    map.on('load', async () => {
      await Promise.all([
        loadIcon(map, 'solmad-sun', makeSunIconDataURL()),
        loadIcon(map, 'solmad-shadow', makeShadowIconDataURL())
      ]);

      map.addSource('terrazas', { type: 'geojson', data: fc });

      // Sombra: punto azul oscuro
      map.addLayer({
        id: 'terrazas-shadow',
        type: 'circle',
        source: 'terrazas',
        filter: ['!=', ['get', 'sun'], 1],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 2.5, 15, 4, 18, 7
          ],
          'circle-color': '#1B2D44',
          'circle-stroke-color': '#0E1B2C',
          'circle-stroke-width': 1,
          'circle-opacity': 0.7
        }
      });

      // Sol: icono soleo
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
            12, 0.32, 15, 0.5, 18, 0.85
          ]
        }
      });

      // Hit-area invisible
      map.addLayer({
        id: 'terrazas-hit',
        type: 'circle',
        source: 'terrazas',
        paint: { 'circle-radius': 18, 'circle-color': '#000', 'circle-opacity': 0 }
      });

      // Fuente de la posición del usuario
      map.addSource('user-loc', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'user-loc-halo',
        type: 'circle',
        source: 'user-loc',
        paint: {
          'circle-radius': 22,
          'circle-color': '#3B82F6',
          'circle-opacity': 0.15
        }
      });
      map.addLayer({
        id: 'user-loc-dot',
        type: 'circle',
        source: 'user-loc',
        paint: {
          'circle-radius': 7,
          'circle-color': '#3B82F6',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2.5
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

      const setCursor = (val: string) => { map.getCanvas().style.cursor = val; };
      ['terrazas-hit', 'terrazas-sun', 'terrazas-shadow'].forEach((id) => {
        map.on('mouseenter', id, (e) => {
          setCursor('pointer');
          const f = e.features?.[0];
          if (f) setHoveredId(Number(f.properties!.id));
        });
        map.on('mouseleave', id, () => { setCursor(''); setHoveredId(null); });
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [setSelectedId, setHoveredId]);

  // Actualizar terrazas
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('terrazas') as GeoJSONSource | undefined;
      if (src) src.setData(fc);
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [fc]);

  // Actualizar posición del usuario
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('user-loc') as GeoJSONSource | undefined;
      if (!src) return;
      if (userLocation) {
        src.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [userLocation.lng, userLocation.lat] },
            properties: {}
          }]
        });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [userLocation]);

  return (
    <div className="absolute inset-0 bg-[#EDE6D6]">
      <div ref={ref} className="absolute inset-0" aria-label="Mapa de Madrid" />
      {!tilesLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-[#EDE6D6]">
          <div className="text-night-700/70 font-display text-lg flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-sun-300 animate-pulse" />
            Cargando mapa de Madrid…
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-night-700">
          <div className="text-paper text-center px-6">
            <p className="font-display text-xl mb-2">No se pudo cargar el mapa</p>
            <p className="text-paper/60 text-sm">{mapError}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function flyToTerraza(t: Terraza) {
  const w = window as any;
  if (w.__solmad_map) {
    w.__solmad_map.flyTo({ center: [t.lng, t.lat], zoom: 17.2, speed: 0.9, curve: 1.6 });
  }
}

export function flyToUser(lat: number, lng: number) {
  const w = window as any;
  if (w.__solmad_map) {
    w.__solmad_map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.0 });
  }
}
