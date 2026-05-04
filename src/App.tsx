import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Intro } from './components/Intro';
import { MapView } from './components/MapView';
import { TimeWheel } from './components/TimeWheel';
import { DetailPanel } from './components/DetailPanel';
import { SideList } from './components/SideList';
import { SurpriseButton } from './components/SurpriseButton';
import { FloatingTimeControl } from './components/FloatingTimeControl';
import { LocationButton } from './components/LocationButton';
import { MeNowBadge } from './components/MeNowBadge';
import { LegalNotice } from './components/LegalNotice';
import { useAppStore } from './store/useAppStore';
import { loadTerrazas, bbox } from './lib/terrazas';
import { fetchBuildings } from './lib/buildings';
import { shadowsApi, ribbonApi } from './workers/shadowsClient';

const GEO_CACHE_KEY = 'solmad:userLocation:v1';

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
  const [appStarted, setAppStarted] = useState(false);

  const fullDebRef = useRef<number | null>(null);
  const quickDebRef = useRef<number | null>(null);
  const fullSeqRef = useRef(0);
  const quickSeqRef = useRef(0);

  const requestUserLocation = () => {
    if (!window.isSecureContext || !('geolocation' in navigator)) { setGeoStatus('unavailable'); return; }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setGeoStatus('granted');
        try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...loc, t: Date.now() })); } catch { /* ignore */ }
      },
      (err) => { setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  // Hidrata ubicación si ya estaba concedida. La primera petición vive en el CTA de Intro.
  useEffect(() => {
    if (!introDone) return;
    setAppStarted(true);
    // 1) Restaura desde localStorage (sobrevive a reloads en Vercel mientras se concede el permiso)
    try {
      const cached = localStorage.getItem(GEO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && Date.now() - (parsed.t ?? 0) < 7 * 24 * 60 * 60 * 1000) {
          setUserLocation({ lat: parsed.lat, lng: parsed.lng });
        }
      }
    } catch { /* ignore */ }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setGeoStatus('unavailable'); return; }
    if (!navigator.permissions?.query) return;

    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((permission) => {
      if (permission.state !== 'granted') {
        if (permission.state === 'denied') setGeoStatus('denied');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setGeoStatus('granted');
          try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...loc, t: Date.now() })); } catch { /* ignore */ }
        },
        (err) => { setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
      );
    }).catch(() => undefined);
  }, [introDone, setUserLocation, setGeoStatus]);

  const startApp = () => {
    setAppStarted(true);
    requestUserLocation();
  };

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
      {appStarted && (
        <>
          <MapView />

          {/* UI flotante */}
          <SurpriseButton />
          <LocationButton />
          <MeNowBadge />
          <SideList />
          <FloatingTimeControl />
          <DetailPanel />

          <div className="fixed bottom-0 left-0 right-0 z-20 pb-safe pointer-events-none">
            <TimeWheel />
            {/* Créditos: hecho con amor por David Antizar — debajo de todo */}
            <div className="pointer-events-auto text-center pt-1.5 pb-1 px-2 bg-night-900/70 backdrop-blur-sm">
              <a
                href="https://github.com/Ntizar/solmad"
                target="_blank" rel="noreferrer"
                className="text-[10px] text-paper/65 hover:text-sun-300 transition tracking-wide font-display"
              >
                Hecho con ♥ por <strong className="text-paper/80">David Antizar</strong> · datos OSM + Madrid Abierto
              </a>
              <span className="mx-1.5 text-paper/30">·</span>
              <LegalNotice />
            </div>
          </div>
        </>
      )}

      <AnimatePresence>{!introDone && <Intro onDone={startApp} />}</AnimatePresence>
    </div>
  );
}
