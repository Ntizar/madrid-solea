import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { flyToUser } from './MapView';

const GEO_CACHE_KEY = 'solmad:userLocation:v1';

export function LocationButton() {
  const geoStatus = useAppStore((s) => s.geoStatus);
  const userLocation = useAppStore((s) => s.userLocation);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setGeoStatus = useAppStore((s) => s.setGeoStatus);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const locate = () => {
    setErrMsg(null);
    if (userLocation) {
      flyToUser(userLocation.lat, userLocation.lng);
      if (navigator.geolocation && window.isSecureContext) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...loc, t: Date.now() })); } catch { /* ignore */ }
          },
          () => undefined,
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
        );
      }
      return;
    }
    if (!window.isSecureContext) { setGeoStatus('unavailable'); setErrMsg('Necesita HTTPS'); return; }
    if (!navigator.geolocation) { setGeoStatus('unavailable'); setErrMsg('Sin geolocalización'); return; }
    setGeoStatus('asking');

    const onSuccess = (pos: GeolocationPosition) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      setGeoStatus('granted');
      try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...loc, t: Date.now() })); } catch { /* ignore */ }
      flyToUser(loc.lat, loc.lng);
    };
    const onErrorFinal = (err: GeolocationPositionError) => {
      setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      setErrMsg(
        err.code === err.PERMISSION_DENIED ? 'Permiso denegado'
        : err.code === err.POSITION_UNAVAILABLE ? 'Sin señal GPS'
        : err.code === err.TIMEOUT ? 'Tardó demasiado'
        : 'Error de ubicación'
      );
    };
    // 1) Intento rápido (red/wifi); 2) si falla, alta precisión
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => {
        navigator.geolocation.getCurrentPosition(onSuccess, onErrorFinal, {
          enableHighAccuracy: true, timeout: 20_000, maximumAge: 0
        });
      },
      { enableHighAccuracy: false, timeout: 6_000, maximumAge: 5 * 60_000 }
    );
  };

  const label = userLocation
    ? 'Mi ubicación'
    : geoStatus === 'asking'
      ? 'Buscando…'
      : errMsg ?? 'Usar mi ubicación';

  // Cuando ya tenemos ubicación, MeNowBadge actúa como botón principal de centrado.
  // Ocultamos este en móvil para no chocar con la badge centrada.
  const hideOnMobile = !!userLocation;

  return (
    <button
      onClick={locate}
      disabled={geoStatus === 'asking'}
      className={`fixed top-16 right-4 z-30 rounded-full bg-paper/92 text-night-900 border border-night-900/10 shadow-xl backdrop-blur px-4 py-2 text-sm font-medium hover:bg-white transition disabled:opacity-70 max-w-[55vw] truncate ${hideOnMobile ? 'hidden sm:inline-flex' : ''}`}
      aria-label="Usar mi ubicación"
      title={errMsg ?? (geoStatus === 'denied' ? 'Activa el permiso de ubicación del navegador para solmad.vercel.app' : undefined)}
    >
      ⌖ {label}
    </button>
  );
}