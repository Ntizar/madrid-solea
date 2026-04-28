import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useAppStore } from '../store/useAppStore';
import type { Terraza } from '../lib/types';

const MADRID_CENTER: [number, number] = [40.4168, -3.7038];

const HOT_TILES = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';

function makeSunIcon() {
  return L.divIcon({
    className: 'solmad-sun-marker',
    html: '<span>☀</span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function makeShadowIcon() {
  return L.divIcon({
    className: 'solmad-shadow-marker',
    html: '<span></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

function makeUserIcon() {
  return L.divIcon({
    className: 'solmad-user-marker',
    html: '<span></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const terraceLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const tileFallbackStepRef = useRef(0);

  const terrazas = useAppStore((s) => s.terrazas);
  const quickSun = useAppStore((s) => s.quickSun);
  const setSelectedId = useAppStore((s) => s.setSelectedId);
  const setHoveredId = useAppStore((s) => s.setHoveredId);
  const userLocation = useAppStore((s) => s.userLocation);

  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const sunIcon = useMemo(() => makeSunIcon(), []);
  const shadowIcon = useMemo(() => makeShadowIcon(), []);
  const userIcon = useMemo(() => makeUserIcon(), []);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const map = L.map(ref.current, {
      center: MADRID_CENTER,
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true
    });

    mapRef.current = map;
    (window as any).__solmad_map = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const hot = L.tileLayer(HOT_TILES, {
      attribution: '© OpenStreetMap contributors · Tiles courtesy of HOT',
      maxZoom: 20,
      subdomains: ['a', 'b', 'c'],
      crossOrigin: true
    });

    const osm = L.tileLayer(OSM_TILES, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      crossOrigin: true
    });

    const carto = L.tileLayer(CARTO_TILES, {
      attribution: '© OpenStreetMap contributors · © CARTO',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      crossOrigin: true
    });

    const tileLayers = [hot, osm, carto];
    const onLoad = () => setTilesLoaded(true);
    tileLayers.forEach((layer) => layer.on('load tileload', onLoad));
    const fallback = () => {
      if (tileFallbackStepRef.current >= tileLayers.length - 1) {
        setMapError('No se han podido descargar las teselas del mapa.');
        return;
      }
      const current = tileLayers[tileFallbackStepRef.current];
      tileFallbackStepRef.current += 1;
      const next = tileLayers[tileFallbackStepRef.current];
      map.removeLayer(current);
      next.addTo(map);
    };
    hot.on('tileerror', fallback);
    osm.on('tileerror', fallback);
    carto.on('tileerror', () => setMapError('No se han podido descargar las teselas del mapa.'));
    hot.addTo(map);

    terraceLayerRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 19,
      maxClusterRadius: (zoom) => (zoom >= 17 ? 24 : 52),
      iconCreateFunction: (cluster) => {
        const children = cluster.getAllChildMarkers();
        const sunny = children.filter((marker) => (marker.options as any).sunny).length;
        const count = cluster.getChildCount();
        return L.divIcon({
          className: 'solmad-cluster-marker',
          html: `<span>${sunny ? '☀' : '·'}</span><strong>${count}</strong>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });
      }
    }).addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    const resize = window.setTimeout(() => map.invalidateSize(), 250);

    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      terraceLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = terraceLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    terrazas.forEach((terraza, index) => {
      const state = quickSun ? quickSun[index] : -1;
      const isSunny = state === 1;
      const marker = L.marker([terraza.lat, terraza.lng], {
        icon: isSunny ? sunIcon : shadowIcon,
        title: terraza.name,
        riseOnHover: true
      } as L.MarkerOptions & { sunny?: boolean });
      (marker.options as any).sunny = isSunny;
      (marker.options as any).state = state;

      marker.on('click', () => setSelectedId(terraza.id));
      marker.on('mouseover', () => setHoveredId(terraza.id));
      marker.on('mouseout', () => setHoveredId(null));
      marker.addTo(layer);
    });
  }, [terrazas, quickSun, setSelectedId, setHoveredId, sunIcon, shadowIcon]);

  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userLocation) return;

    L.circle([userLocation.lat, userLocation.lng], {
      radius: 45,
      color: '#3B82F6',
      weight: 1,
      fillColor: '#3B82F6',
      fillOpacity: 0.14
    }).addTo(layer);

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, title: 'Tu ubicación' }).addTo(layer);
  }, [userLocation, userIcon]);

  return (
    <div className="absolute inset-0 bg-[#EDE6D6]">
      <div ref={ref} className="absolute inset-0 z-0" aria-label="Mapa de Madrid" />
      {!tilesLoaded && !mapError && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none bg-[#EDE6D6]">
          <div className="text-night-700/70 font-display text-lg flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-sun-300 animate-pulse" />
            Cargando mapa libre de Madrid…
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none bg-night-700/95">
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
  const map = (window as any).__solmad_map as L.Map | undefined;
  if (map) map.flyTo([t.lat, t.lng], 18, { duration: 0.8 });
}

export function flyToUser(lat: number, lng: number) {
  const map = (window as any).__solmad_map as L.Map | undefined;
  if (map) map.flyTo([lat, lng], 16, { duration: 0.8 });
}