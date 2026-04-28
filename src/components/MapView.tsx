import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as pmtiles from 'pmtiles';
import { useAppStore } from '../store/useAppStore';
import type { Terraza } from '../lib/types';

// Registramos el protocolo pmtiles UNA sola vez globalmente.
const _w = window as any;
if (!_w.__solmad_pmtiles) {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  _w.__solmad_pmtiles = true;
}

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
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

  const fc = useMemo(() => buildGeoJSON(terrazas, quickSun), [terrazas, quickSun]);

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
    (window as any).__solmad_map = map;
    map.touchZoomRotate.enableRotation();

    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.warn('[map]', e.error?.message ?? e);
    });

    map.on('load', () => {
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
              'fill-extrusion-opacity': 0.92
            }
          },
          labelLayer?.id
        );
      }

      map.addSource('terrazas', { type: 'geojson', data: fc });

      map.addLayer({
        id: 'terrazas-glow',
        type: 'circle',
        source: 'terrazas',
        filter: ['==', ['get', 'sun'], 1],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 8,
            16, 22,
            18, 32
          ],
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
            11, 3.5,
            14, 6,
            16, 8.5,
            18, 13
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
            1, '#FFFFFF',
            '#0E1B2C'
          ],
          'circle-opacity': 0.95
        }
      });

      const handlePick = (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedId(Number(f.properties!.id));
      };
      map.on('click', 'terrazas-points', handlePick);
      map.on('click', 'terrazas-glow', handlePick);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('terrazas') as GeoJSONSource | undefined;
      if (src) src.setData(fc);
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [fc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const h = selectedDate.getHours() + selectedDate.getMinutes() / 60;
      let bg = '#EDE6D6';
      if (h < 6) bg = '#1B2D44';
      else if (h < 8) bg = '#E5C8A8';
      else if (h < 11) bg = '#E2EAEE';
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
    w.__solmad_map.flyTo({ center: [t.lng, t.lat], zoom: 17.2, pitch: 60, bearing: -20, speed: 0.9, curve: 1.6 });
  }
}
