import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

function fmt(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

function shiftDate(base: Date, minutes: number) {
  const next = new Date(base.getTime() + minutes * 60_000);
  next.setSeconds(0, 0);
  return next;
}

export function FloatingTimeControl() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const isLive = useAppStore((s) => s.isLive);
  const setDate = useAppStore((s) => s.setDate);

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setDate(new Date(), true), 60_000);
    return () => window.clearInterval(id);
  }, [isLive, setDate]);

  return (
    <div className="hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 z-20 items-center gap-2 rounded-full bg-paper/92 text-night-900 border border-night-900/10 shadow-2xl backdrop-blur px-2.5 py-2">
      <button
        onClick={() => setDate(shiftDate(selectedDate, -15), false)}
        aria-label="Restar 15 minutos"
        className="h-9 px-3 rounded-full bg-night-900/5 hover:bg-night-900/10 transition font-mono text-sm"
      >-15</button>

      <div className="px-2 text-center min-w-[128px]">
        <div className="text-[10px] uppercase tracking-widest text-night-900/50">Hora solar</div>
        <div className="font-display text-2xl tabular-nums leading-6">{fmt(selectedDate)}</div>
      </div>

      <button
        onClick={() => setDate(shiftDate(selectedDate, 15), false)}
        aria-label="Sumar 15 minutos"
        className="h-9 px-3 rounded-full bg-night-900/5 hover:bg-night-900/10 transition font-mono text-sm"
      >+15</button>

      <button
        onClick={() => setDate(new Date(), true)}
        className={`h-9 px-4 rounded-full text-sm font-medium transition ${isLive ? 'bg-sun-300 text-night-900 shadow-glow' : 'bg-night-900 text-paper hover:bg-night-500'}`}
      >Ahora</button>
    </div>
  );
}