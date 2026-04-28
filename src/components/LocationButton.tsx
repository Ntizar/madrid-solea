import { useAppStore } from '../store/useAppStore';
import { flyToUser } from './MapView';

export function LocationButton() {
  const geoStatus = useAppStore((s) => s.geoStatus);
  const userLocation = useAppStore((s) => s.userLocation);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setGeoStatus = useAppStore((s) => s.setGeoStatus);

  const locate = () => {
    if (userLocation) {
      flyToUser(userLocation.lat, userLocation.lng);
      return;
    }
    if (!window.isSecureContext) {
      setGeoStatus('unavailable');
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setGeoStatus('granted');
        flyToUser(loc.lat, loc.lng);
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
    );
  };

  const label = userLocation
    ? 'Mi ubicación'
    : geoStatus === 'asking'
      ? 'Buscando...'
      : geoStatus === 'denied'
        ? 'Permiso ubicación'
        : 'Usar mi ubicación';

  return (
    <button
      onClick={locate}
      disabled={geoStatus === 'asking'}
      className="fixed top-16 right-4 z-30 rounded-full bg-paper/92 text-night-900 border border-night-900/10 shadow-xl backdrop-blur px-4 py-2 text-sm font-medium hover:bg-white transition disabled:opacity-70"
      aria-label="Usar mi ubicación"
      title={geoStatus === 'denied' ? 'Activa el permiso de ubicación del navegador para solmad.vercel.app' : undefined}
    >
      ⌖ {label}
    </button>
  );
}