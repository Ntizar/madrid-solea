import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Intro } from './components/Intro';
import { MapView } from './components/MapView';
import { TimeWheel } from './components/TimeWheel';
import { DetailPanel } from './components/DetailPanel';
import { SideList } from './components/SideList';
import { SurpriseButton } from './components/SurpriseButton';
import { FloatingTimeControl } from './components/FloatingTimeControl';
import { LocationButton } from './components/LocationButton';
import { useAppStore } from './store/useAppStore';
import { loadTerrazas, bbox } from './lib/terrazas';
import { fetchBuildings } from './lib/buildings';
import { shadowsApi, ribbonApi } from './workers/shadowsClient';

export function App() {
  const introDone = useAppStore((s) => s.introDone);
  const terrazas = useAppStore((s) => s.terrazas);
  const buildingsLoaded = useAppStore((s) => s.buildingsLoaded);
  const setTerrazas = useAppStore((s) => s.setTerrazas);
  const setBuildings = useAppStore((s) => s.setBuildings);
  const setBuildingsLoaded = useAppStore((s) => s.setBuildingsLoaded);
  const setSunStates = useAppStore((s) => s.setSunStates);
  const setQuickSun = useAppStore((s) => s.setQuickSun);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setGeoStatus = useAppStore((s) => s.setGeoStatus);
  const selectedDate = useAppStore((s) => s.selectedDate);

  const fullDebRef = useRef<number | null>(null);
  const quickDebRef = useRef<number | null>(null);
  const fullSeqRef = useRef(0);
  const quickSeqRef = useRef(0);

  // Hidrata ubicación si ya estaba concedida. La petición nueva vive en LocationButton (gesto de usuario).
  useEffect(() => {
    if (!introDone) return;
    if (!('geolocation' in navigator)) { setGeoStatus('unavailable'); return; }
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((permission) => {
      if (permission.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus('granted');
        },
        () => { setGeoStatus('denied'); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
      );
    }).catch(() => undefined);
  }, [introDone, setUserLocation, setGeoStatus]);

  // 1) Cargar terrazas y luego edificios + worker
  useEffect(() => {
    (async () => {
      const ts = await loadTerrazas();
      setTerrazas(ts);

      const bb = bbox(ts);
      // Cubre todos los distritos con terrazas. Antes estaba recortado a centro/M-30
      // y barrios como Villaverde calculaban sin edificios alrededor.
      const south = Math.max(40.30, bb.minLat - 0.006);
      const north = Math.min(40.55, bb.maxLat + 0.006);
      const west = Math.max(-3.85, bb.minLng - 0.006);
      const east = Math.min(-3.52, bb.maxLng + 0.006);
      const originLng = (west + east) / 2;
      const originLat = (south + north) / 2;

      const api = shadowsApi();
      try {
        const buildings = await fetchBuildings([south, west, north, east]);
        setBuildings(buildings);
        await api.setBuildings(buildings, originLng, originLat);
        // Mismo dataset al worker dedicado a ribbons (no comparte memoria con
        // Comlink, pero el coste es asumible y el ribbon ya no espera al masivo)
        await ribbonApi().setBuildings(buildings, originLng, originLat);
        setBuildingsLoaded(true);
      } catch (err) {
        console.warn('[solmad] Overpass falló, usando modo sin sombras:', err);
        setBuildings([]);
        await api.setBuildings([], originLng, originLat);
        await ribbonApi().setBuildings([], originLng, originLat);
        setBuildingsLoaded(true); // seguimos: todo "soleado" si la altitud > 0
      }
    })();
  }, [setTerrazas, setBuildings, setBuildingsLoaded]);

  // 2) Recálculo "rápido" (solo sunNow) cuando se mueve el slider — debounced 80ms
  useEffect(() => {
    if (!buildingsLoaded || terrazas.length === 0) return;
    const seq = ++quickSeqRef.current;
    setQuickSun(null);
    if (quickDebRef.current) clearTimeout(quickDebRef.current);
    quickDebRef.current = window.setTimeout(async () => {
      const api = shadowsApi();
      const u = await api.quickFor(terrazas, selectedDate.toISOString());
      if (seq === quickSeqRef.current) setQuickSun(u);
    }, 80);
    return () => { if (quickDebRef.current) clearTimeout(quickDebRef.current); };
  }, [selectedDate, terrazas, buildingsLoaded, setQuickSun]);

  // 3) Recálculo "completo" (minutosLeft + ribbon) tras 600ms sin cambios
  useEffect(() => {
    if (!buildingsLoaded || terrazas.length === 0) return;
    const seq = ++fullSeqRef.current;
    setSunStates(new Map());
    if (fullDebRef.current) clearTimeout(fullDebRef.current);
    fullDebRef.current = window.setTimeout(async () => {
      const api = shadowsApi();
      const states = await api.computeFor(terrazas, selectedDate.toISOString());
      if (seq !== fullSeqRef.current) return;
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
      <LocationButton />
      <SideList />
      <FloatingTimeControl />
      <DetailPanel />

      <div className="fixed bottom-0 left-0 right-0 z-20 pb-3 pb-safe pointer-events-none">
        <TimeWheel />
      </div>

      <AnimatePresence>{!introDone && <Intro />}</AnimatePresence>

      {/* Créditos: hecho con amor por David Antizar */}
      <a
        href="https://github.com/Ntizar/solmad"
        target="_blank" rel="noreferrer"
        className="fixed right-4 bottom-[116px] z-20 rounded-full bg-paper/90 text-night-900 border border-night-900/10 shadow-xl backdrop-blur px-3 py-1.5 text-[11px] hover:bg-white transition tracking-wide font-display"
      >
        Hecho con ♥ por <strong className="text-night-900/85">David Antizar</strong> para los disfrutones de Madrid
      </a>
    </div>
  );
}
