import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { flyToTerraza } from './MapView';

export function SideList() {
  const terrazas = useAppStore((s) => s.terrazas);
  const sunStates = useAppStore((s) => s.sunStates);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const setSelectedId = useAppStore((s) => s.setSelectedId);
  const [open, setOpen] = useState(false);

  const distritos = useMemo(() => {
    const set = new Set(terrazas.map((t) => t.distrito).filter(Boolean));
    return [...set].sort();
  }, [terrazas]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return terrazas
      .map((t) => ({ t, sun: sunStates.get(t.id) }))
      .filter(({ t, sun }) => {
        if (filters.distrito && t.distrito !== filters.distrito) return false;
        if (filters.minHours && (!sun || sun.minutesLeft < filters.minHours * 60)) return false;
        if (filters.onlyOpenNow && sun && !sun.sunNow) return false;
        if (q && !t.name.toLowerCase().includes(q) && !t.via.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.sun?.minutesLeft ?? 0) - (a.sun?.minutesLeft ?? 0))
      .slice(0, 50);
  }, [terrazas, sunStates, filters]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed top-4 left-4 z-30 rounded-full bg-night-700/80 backdrop-blur border border-white/10 px-4 py-2 text-paper/90 hover:text-sun-300 transition shadow-xl"
      >
        <span className="font-display text-base">{open ? 'Cerrar' : 'Top sol ahora'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            className="
              fixed z-30 top-0 left-0 h-full bg-night-700/95 backdrop-blur border-r border-white/10
              w-full sm:w-[360px] flex flex-col text-paper
            "
          >
            <div className="p-4 pt-16 border-b border-white/10 space-y-2">
              <input
                value={filters.query}
                onChange={(e) => setFilters({ query: e.target.value })}
                placeholder="Buscar por local o calle…"
                className="w-full bg-white/5 rounded-xl px-4 py-3 text-paper placeholder-paper/40 outline-none focus:ring-2 focus:ring-sun-300"
              />
              <div className="flex gap-2">
                <select
                  value={filters.distrito ?? ''}
                  onChange={(e) => setFilters({ distrito: e.target.value || null })}
                  className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-paper/90 outline-none"
                >
                  <option value="">Todos los distritos</option>
                  {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={filters.minHours}
                  onChange={(e) => setFilters({ minHours: Number(e.target.value) })}
                  className="bg-white/5 rounded-xl px-3 py-2 text-paper/90 outline-none"
                >
                  <option value={0}>Cualquier sol</option>
                  <option value={1}>≥ 1 h</option>
                  <option value={2}>≥ 2 h</option>
                  <option value={3}>≥ 3 h</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-paper/80">
                <input
                  type="checkbox"
                  checked={filters.onlyOpenNow}
                  onChange={(e) => setFilters({ onlyOpenNow: e.target.checked })}
                  className="accent-sun-300"
                />
                Sólo con sol ahora mismo
              </label>
            </div>

            <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filtered.length === 0 && (
                <li className="p-6 text-paper/60 text-sm">Nada encaja con esos filtros. Prueba con otra hora o distrito.</li>
              )}
              {filtered.map(({ t, sun }) => {
                const min = sun?.minutesLeft ?? 0;
                const h = Math.floor(min / 60), mm = min % 60;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => { setSelectedId(t.id); flyToTerraza(t); setOpen(false); }}
                      className="w-full text-left p-4 hover:bg-white/5 transition flex items-center gap-3"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                        sun?.sunNow ? 'bg-sun-300 shadow-glow' : 'bg-night-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg leading-tight truncate">{t.name}</div>
                        <div className="text-xs text-paper/60 truncate">{t.via} {t.num} · {t.barrio}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sun-300 font-mono text-sm">{h}h {mm.toString().padStart(2, '0')}</div>
                        <div className="text-[10px] text-paper/40 uppercase tracking-widest">restante</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
