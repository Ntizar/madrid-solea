import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import SunCalc from 'suncalc';
import { useAppStore } from '../store/useAppStore';

const MADRID: [number, number] = [40.4168, -3.7038];

function fmt(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

function setHourMin(base: Date, h: number, m: number) {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function TimeWheel() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const isLive = useAppStore((s) => s.isLive);
  const setDate = useAppStore((s) => s.setDate);

  // Tick "Ahora" cada minuto si live
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setDate(new Date(), true), 60_000);
    return () => clearInterval(id);
  }, [isLive, setDate]);

  const sunset = useMemo(() => SunCalc.getTimes(selectedDate, MADRID[0], MADRID[1]).sunset, [selectedDate]);

  // Slider 6:00..23:00 = 17h * 12 cuartos = pasos de 5 min
  const minMin = 6 * 60;
  const maxMin = 23 * 60;
  const cur = selectedDate.getHours() * 60 + selectedDate.getMinutes();
  const value = Math.max(minMin, Math.min(maxMin, cur));

  return (
    <div className="pointer-events-auto w-full max-w-3xl mx-auto px-4">
      <div className="rounded-2xl bg-night-700/80 backdrop-blur-md border border-white/10 shadow-2xl px-4 py-3">
        <div className="flex items-center justify-between text-paper/90 mb-2">
          <span className="font-display text-2xl tracking-tight">{fmt(selectedDate)}</span>
          <div className="flex flex-wrap gap-1.5">
            <Preset label="Ahora" onClick={() => setDate(new Date(), true)} active={isLive} />
            <Preset label="Vermut · 12:30" onClick={() => setDate(setHourMin(selectedDate, 12, 30))} />
            <Preset label="Caña · 13:30" onClick={() => setDate(setHourMin(selectedDate, 13, 30))} />
            <Preset label="Comida · 14:30" onClick={() => setDate(setHourMin(selectedDate, 14, 30))} />
            {sunset && <Preset label={`Atardecer · ${fmt(sunset)}`} onClick={() => setDate(new Date(sunset.getTime() - 30 * 60_000))} />}
          </div>
        </div>

        <input
          type="range"
          min={minMin}
          max={maxMin}
          step={5}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            const d = setHourMin(selectedDate, Math.floor(v / 60), v % 60);
            setDate(d, false);
          }}
          className="solea-slider w-full"
          aria-label="Hora del día"
        />
        <div className="flex justify-between text-xs text-paper/60 mt-1 font-mono">
          <span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
        </div>
      </div>
    </div>
  );
}

function Preset({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? 'bg-sun-300 text-night-900 border-sun-300 shadow-glow'
          : 'border-white/15 text-paper/80 hover:border-sun-300 hover:text-sun-300'
      }`}
    >
      {label}
    </motion.button>
  );
}
