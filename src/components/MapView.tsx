import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAppStore } from '../store/useAppStore';
import type { Terraza } from '../lib/types';

// Estilo gratuito con edificios 3D (OpenFreeMap "Liberty")
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MADRID_CENTER: [number, number] = [-3.7038, 40.4168];

function buildGeoJSON(terrazas: Terraza[], quick: Uint8Array | null) {
  return {
    type: 'FeatureCollection',
    features: terrazas.map((t, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        id: t.id,
        name: t.name,
        // 0 sombra, 1 sol, 2 noche, -1 desconocido
        sun: quick ? quick[i] : -1
      }
    }))
  } as GeoJSON.FeatureCollection;
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const terrazas = useAppStore((s) => s.terrazas);
  const quickSun = useAppStore((s) => s.quickSun);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedId = useAppStore((s) => s.setSelectedId);
  const setHoveredId = useAppStore((s) => s.setHoveredId);

  // GeoJSON memoizado por terrazas+quickSun
  const fc = useMemo(() => buildGeoJSON(terrazas, quickSun), [terrazas, quickSun]);

  // Init map una sola vez
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: MADRID_CENTER,
      zoom: 14.5,
      pitch: 55,
      bearing: -17,
      antialias: true,
      attributionControl: { compact: true }
    });
    mapRef.current = map;
    (window as any).__solea_map = map;

    map.on('load', () => {
      // Asegura capa de edificios 3D si el estilo la trae
      const layers = map.getStyle().layers ?? [];
      const labelLayer = layers.find((l) => l.type === 'symbol' && (l.layout as any)?.['text-field']);
      if (!map.getLayer('3d-buildings')) {
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
                14, '#dccdb6',
                17, '#cfbfa7'
              ],
              'fill-extrusion-height': [
                'case',
                ['has', 'render_height'], ['get', 'render_height'],
                ['has', 'height'], ['get', 'height'],
                17
              ],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.9
            }
          },
          labelLayer?.id
        );
      }

      // Fuente y capas de terrazas
      map.addSource('terrazas', { type: 'geojson', data: fc });

      map.addLayer({
        id: 'terrazas-glow',
        type: 'circle',
        source: 'terrazas',
        filter: ['==', ['get', 'sun'], 1],
        paint: {
          'circle-radius': 18,
          'circle-color': '#E8A951',
          'circle-blur': 1,
          'circle-opacity': 0.55
        }
      });

      map.addLayer({
        id: 'terrazas-points',
        type: 'circle',
        source: 'terrazas',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 3,
            16, 7,
            18, 11
          ],
          'circle-color': [
            'match', ['get', 'sun'],
            1, '#E8A951',
            0, '#3A5573',
            2, '#1B2D44',
            '#7a7a7a'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': [
            'match', ['get', 'sun'],
            1, '#FBF1DE',
            '#0E1B2C'
          ],
          'circle-opacity': 0.95
        }
      });

      // Click + hover
      map.on('click', 'terrazas-points', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedId(Number(f.properties!.id));
      });
      map.on('mouseenter', 'terrazas-points', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f) setHoveredId(Number(f.properties!.id));
      });
      map.on('mouseleave', 'terrazas-points', () => {
        map.getCanvas().style.cursor = '';
        setHoveredId(null);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [setSelectedId, setHoveredId]);

  // Update GeoJSON cuando cambian datos / sol
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('terrazas') as GeoJSONSource | undefined;
      if (src) src.setData(fc);
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [fc]);

  // Cambia tono del cielo / luz según hora
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const h = selectedDate.getHours() + selectedDate.getMinutes() / 60;
      // Curva: 6→azul aurora, 9→cielo claro, 13→pleno, 19→ámbar, 22→noche
      let bg = '#9CB6CC';
      if (h < 6 || h > 22) bg = '#0E1B2C';
      else if (h < 8) bg = '#C99B7C';
      else if (h < 11) bg = '#BFD3DE';
      else if (h < 17) bg = '#D8DEDE';
      else if (h < 20) bg = '#E8A951';
      else bg = '#3A4E69';
      const layer = map.getLayer('background');
      if (layer) map.setPaintProperty('background', 'background-color', bg);
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [selectedDate]);

  return <div ref={ref} className="absolute inset-0" aria-label="Mapa de Madrid" />;
}

export function flyToTerraza(t: Terraza) {
  // Util: el componente expone una API global mínima vía window para SurpriseButton.
  const w = window as any;
  if (w.__solea_map) {
    w.__solea_map.flyTo({ center: [t.lng, t.lat], zoom: 17.2, pitch: 60, bearing: -20, speed: 0.9, curve: 1.6 });
  }
}
