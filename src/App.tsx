import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Intro } from './components/Intro';
import { MapView } from './components/MapView';
import { TimeWheel } from './components/TimeWheel';
import { DetailPanel } from './components/DetailPanel';
import { SideList } from './components/SideList';
import { SurpriseButton } from './components/SurpriseButton';
import { useAppStore } from './store/useAppStore';
import { loadTerrazas, bbox } from './lib/terrazas';
import { fetchBuildings } from './lib/buildings';
import { shadowsApi, ribbonApi } from './workers/shadowsClient';

export function App() {
  const introDone = useAppStore((s) => s.introDone);
  const terrazas = useAppStore((s) => s.terrazas);
  const buildingsLoaded = useAppStore((s) => s.buildingsLoaded);
  const setTerrazas = useAppStore((s) => s.setTerrazas);
  const setBuildingsLoaded = useAppStore((s) => s.setBuildingsLoaded);
  const setSunStates = useAppStore((s) => s.setSunStates);
  const setQuickSun = useAppStore((s) => s.setQuickSun);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setGeoStatus = useAppStore((s) => s.setGeoStatus);
  const selectedDate = useAppStore((s) => s.selectedDate);

  const fullDebRef = useRef<number | null>(null);
  const quickDebRef = useRef<number | null>(null);

  // Pedir ubicación cuando termine el intro (mejor UX que pedirla nada más entrar)
  useEffect(() => {
    if (!introDone) return;
    if (!('geolocation' in navigator)) { setGeoStatus('unavailable'); return; }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => { setGeoStatus('denied'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }, [introDone, setUserLocation, setGeoStatus]);

  // 1) Cargar terrazas y luego edificios + worker
  useEffect(() => {
    (async () => {
      const ts = await loadTerrazas();
      setTerrazas(ts);

      const bb = bbox(ts);
      // Recortamos a un bbox razonable (Madrid centro/M-30) para evitar Overpass enorme
      const south = Math.max(40.36, bb.minLat);
      const north = Math.min(40.49, bb.maxLat);
      const west = Math.max(-3.78, bb.minLng);
      const east = Math.min(-3.61, bb.maxLng);

      const api = shadowsApi();
      try {
        const buildings = await fetchBuildings([south, west, north, east]);
        const originLng = (west + east) / 2;
        const originLat = (south + north) / 2;
        await api.setBuildings(buildings, originLng, originLat);
        // Mismo dataset al worker dedicado a ribbons (no comparte memoria con
        // Comlink, pero el coste es asumible y el ribbon ya no espera al masivo)
        await ribbonApi().setBuildings(buildings, originLng, originLat);
        setBuildingsLoaded(true);
      } catch (err) {
        console.warn('[solmad] Overpass falló, usando modo sin sombras:', err);
        setBuildingsLoaded(true); // seguimos: todo "soleado" si la altitud > 0
      }
    })();
  }, [setTerrazas, setBuildingsLoaded]);

  // 2) Recálculo "rápido" (solo sunNow) cuando se mueve el slider — debounced 80ms
  useEffect(() => {
    if (!buildingsLoaded || terrazas.length === 0) return;
    if (quickDebRef.current) clearTimeout(quickDebRef.current);
    quickDebRef.current = window.setTimeout(async () => {
      const api = shadowsApi();
      const u = await api.quickFor(terrazas, selectedDate.toISOString());
      setQuickSun(u);
    }, 80);
    return () => { if (quickDebRef.current) clearTimeout(quickDebRef.current); };
  }, [selectedDate, terrazas, buildingsLoaded, setQuickSun]);

  // 3) Recálculo "completo" (minutosLeft + ribbon) tras 600ms sin cambios
  useEffect(() => {
    if (!buildingsLoaded || terrazas.length === 0) return;
    if (fullDebRef.current) clearTimeout(fullDebRef.current);
    fullDebRef.current = window.setTimeout(async () => {
      const api = shadowsApi();
      const states = await api.computeFor(terrazas, selectedDate.toISOString());
      const map = new Map<number, typeof states[number]>();
      terrazas.forEach((t, i) => map.set(t.id, states[i]));
      setSunStates(map);
    }, 600);
    return () => { if (fullDebRef.current) clearTimeout(fullDebRef.current); };
  }, [selectedDate, terrazas, buildingsLoaded, setSunStates]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-700">
      <MapView />

      {/* UI flotante */}
      <SurpriseButton />
      <SideList />
      <DetailPanel />

      <div className="fixed bottom-0 left-0 right-0 z-20 pb-3 pb-safe pointer-events-none">
        <TimeWheel />
      </div>

      <AnimatePresence>{!introDone && <Intro />}</AnimatePresence>

      {/* Créditos: hecho con amor por David Antizar */}
      <a
        href="https://github.com/Ntizar/solmad"
        target="_blank" rel="noreferrer"
        className="hidden md:block fixed bottom-3 left-1/2 -translate-x-1/2 z-10 text-[11px] text-paper/60 hover:text-sun-300 transition tracking-wide font-display"
      >
        Hecho con ♥ por <strong className="text-paper/80">David Antizar</strong> para los disfrutones de Madrid
      </a>
    </div>
  );
}
