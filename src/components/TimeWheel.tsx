import { useEffect, useMemo, useRef } from 'react';
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

interface Preset { label: string; short: string; getDate: (base: Date, sunset?: Date) => Date; live?: boolean; }

export function TimeWheel() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const isLive = useAppStore((s) => s.isLive);
  const setDate = useAppStore((s) => s.setDate);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setDate(new Date(), true), 60_000);
    return () => clearInterval(id);
  }, [isLive, setDate]);

  const sunset = useMemo(() => SunCalc.getTimes(selectedDate, MADRID[0], MADRID[1]).sunset, [selectedDate]);

  const presets: Preset[] = useMemo(() => [
    { label: 'Ahora',                 short: 'Ahora',     getDate: () => new Date(), live: true },
    { label: 'Desayuno · 10:00',      short: 'Desayuno',  getDate: (b) => setHourMin(b, 10, 0) },
    { label: 'Vermut · 12:30',        short: 'Vermut',    getDate: (b) => setHourMin(b, 12, 30) },
    { label: 'Caña · 13:30',          short: 'Caña',      getDate: (b) => setHourMin(b, 13, 30) },
    { label: 'Comida · 14:30',        short: 'Comida',    getDate: (b) => setHourMin(b, 14, 30) },
    { label: 'Merienda · 18:00',      short: 'Merienda',  getDate: (b) => setHourMin(b, 18, 0) },
    { label: sunset ? `Atardecer · ${fmt(sunset)}` : 'Atardecer', short: 'Atardecer', getDate: (b, s) => s ? new Date(s.getTime() - 30 * 60_000) : setHourMin(b, 21, 0) }
  ], [sunset]);

  const minMin = 6 * 60;
  const maxMin = 23 * 60;
  const cur = selectedDate.getHours() * 60 + selectedDate.getMinutes();
  const value = Math.max(minMin, Math.min(maxMin, cur));

  const chipsRef = useRef<HTMLDivElement>(null);

  // Detecta cuál preset está activo (matching rough)
  const activeIdx = useMemo(() => {
    if (isLive) return 0;
    const cm = selectedDate.getHours() * 60 + selectedDate.getMinutes();
    for (let i = 1; i < presets.length; i++) {
      const p = presets[i].getDate(selectedDate, sunset ?? undefined);
      const pm = p.getHours() * 60 + p.getMinutes();
      if (Math.abs(pm - cm) <= 2) return i;
    }
    return -1;
  }, [isLive, selectedDate, presets, sunset]);

  return (
    <div
      className="
        pointer-events-auto w-full
        sm:max-w-3xl sm:mx-auto sm:px-4
      "
    >
      <div
        className="
          bg-night-700/90 sm:bg-night-700/85 backdrop-blur-md
          border-t border-white/10 sm:border sm:border-white/10 sm:shadow-2xl
          sm:rounded-2xl
          px-4 pt-3 pb-3 sm:px-5 sm:py-4
        "
      >
        {/* Fila 1: hora gigante + estado live */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display text-3xl sm:text-2xl tracking-tight text-paper tabular-nums">
            {fmt(selectedDate)}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1.5 text-sun-300 text-[10px] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-sun-300 animate-pulse" />
              en vivo
            </span>
          ) : (
            <button
              onClick={() => setDate(new Date(), true)}
              className="text-[10px] uppercase tracking-widest text-paper/60 hover:text-sun-300 transition"
            >
              volver a ahora →
            </button>
          )}
        </div>

        {/* Fila 2: slider gordo táctil */}
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
        <div className="flex justify-between text-[10px] text-paper/45 mt-0.5 font-mono">
          <span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>23</span>
        </div>

        {/* Fila 3: chips scrollables horizontales */}
        <div
          ref={chipsRef}
          className="
            mt-2 flex gap-1.5 overflow-x-auto no-scrollbar
            -mx-4 px-4 sm:mx-0 sm:px-0
            snap-x snap-mandatory
          "
          style={{ scrollPaddingLeft: 16 }}
        >
          {presets.map((p, i) => {
            const active = i === activeIdx;
            return (
              <motion.button
                key={p.short}
                whileTap={{ scale: 0.93 }}
                onClick={() => setDate(p.getDate(selectedDate, sunset ?? undefined), !!p.live)}
                className={`
                  shrink-0 snap-start text-[13px] sm:text-xs
                  px-3.5 py-2 sm:py-1.5 rounded-full border transition
                  ${active
                    ? 'bg-sun-300 text-night-900 border-sun-300 shadow-glow font-medium'
                    : 'border-white/15 text-paper/85 hover:border-sun-300 hover:text-sun-300 active:bg-white/10'}
                `}
              >
                <span className="sm:hidden">{p.short}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
