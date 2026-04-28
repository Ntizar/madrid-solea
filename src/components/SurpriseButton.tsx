import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { flyToTerraza } from './MapView';

function dist2(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lng - b.lng, dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

export function SurpriseButton() {
  const terrazas = useAppStore((s) => s.terrazas);
  const sunStates = useAppStore((s) => s.sunStates);
  const setSelectedId = useAppStore((s) => s.setSelectedId);

  async function surprise() {
    const candidates = terrazas
      .map((t) => ({ t, sun: sunStates.get(t.id) }))
      .filter(({ sun }) => sun && sun.sunNow && sun.minutesLeft >= 45);
    if (candidates.length === 0) return;

    const me = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 4000 }
      );
    });

    let pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (me) {
      const sorted = [...candidates].sort((a, b) => dist2(a.t, me) - dist2(b.t, me));
      pick = sorted[Math.floor(Math.random() * Math.min(8, sorted.length))]; // top 8 cercanas
    }
    setSelectedId(pick.t.id);
    flyToTerraza(pick.t);
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      onClick={surprise}
      className="fixed top-4 right-4 z-30 rounded-full bg-sun-300 text-night-900 font-display text-base px-5 py-2.5 shadow-glow hover:bg-sun-100 transition"
      aria-label="Sorpréndeme con una terraza al sol"
    >
      ☀ Sorpréndeme
    </motion.button>
  );
}
