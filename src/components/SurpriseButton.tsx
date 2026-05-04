import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { flyToTerraza } from './MapView';
import type { Terraza } from '../lib/types';

function dist2(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lng - b.lng, dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

export function SurpriseButton() {
  const terrazas = useAppStore((s) => s.terrazas);
  const sunStates = useAppStore((s) => s.sunStates);
  const userLocation = useAppStore((s) => s.userLocation);
  const setSelectedId = useAppStore((s) => s.setSelectedId);

  async function surprise() {
    // 1) Si tenemos sunStates calculados, busca con sol
    let candidates = terrazas
      .map((t) => ({ t, sun: sunStates.get(t.id) }))
      .filter(({ sun }) => sun?.sunNow);

    // 2) Si no hay datos solares aún, o nadie tiene sol, suelta cualquiera abierta
    if (candidates.length === 0) {
      candidates = terrazas.map((t) => ({ t, sun: sunStates.get(t.id) }));
    }
    if (candidates.length === 0) return;

    // No pedimos geolocalizacion desde Sorpresa: en iPhone puede bloquear permiso.
    const me = userLocation;

    let pick: { t: Terraza };
    if (me) {
      const sorted = [...candidates].sort((a, b) => dist2(a.t, me) - dist2(b.t, me));
      // Top 12 cercanas, una al azar
      pick = sorted[Math.floor(Math.random() * Math.min(12, sorted.length))];
    } else {
      // Sin geo: random total entre las que tienen más sol restante (top 30)
      const sorted = [...candidates].sort((a, b) => (b.sun?.directMinutes ?? b.sun?.minutesLeft ?? 0) - (a.sun?.directMinutes ?? a.sun?.minutesLeft ?? 0));
      const pool = sorted.slice(0, 30);
      pick = pool[Math.floor(Math.random() * pool.length)];
    }

    setSelectedId(pick.t.id);
    flyToTerraza(pick.t);
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.94 }}
      onClick={surprise}
      className="
        fixed top-4 right-4 z-30
        rounded-full bg-sun-300 text-night-900 font-display font-medium
        text-sm sm:text-base
        px-4 sm:px-5 py-2.5 sm:py-2.5
        shadow-glow hover:bg-sun-100 transition
      "
      aria-label="Sorpréndeme con una terraza al sol"
    >
      ☀ <span className="hidden xs:inline">Sorpréndeme</span><span className="xs:hidden">Sorpresa</span>
    </motion.button>
  );
}
