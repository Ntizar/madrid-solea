import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { SunRhythm } from './SunRhythm';

function fmtMin(m: number) {
  if (m <= 0) return 'sin sol restante';
  const h = Math.floor(m / 60), mm = m % 60;
  if (!h) return `${mm} min de sol`;
  return `${h} h ${mm.toString().padStart(2, '0')} min de sol`;
}

export function DetailPanel() {
  const id = useAppStore((s) => s.selectedId);
  const terrazas = useAppStore((s) => s.terrazas);
  const sunStates = useAppStore((s) => s.sunStates);
  const close = useAppStore((s) => s.setSelectedId);
  const t = id != null ? terrazas.find((x) => x.id === id) : null;
  const sun = id != null ? sunStates.get(id) : undefined;

  return (
    <AnimatePresence>
      {t && (
        <motion.aside
          key={t.id}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="
            fixed z-30 bg-night-700/95 backdrop-blur border-l border-white/10 text-paper
            md:top-0 md:right-0 md:h-full md:w-[380px]
            bottom-0 left-0 right-0 max-h-[78vh] md:max-h-none
            md:rounded-none rounded-t-3xl shadow-2xl overflow-hidden flex flex-col
          "
        >
          <div className="md:hidden flex justify-center py-2">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="px-5 pb-5 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pt-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-sun-300/90">{t.distrito} · {t.barrio}</p>
                <h2 className="font-display text-3xl leading-tight mt-1">{t.name}</h2>
                <p className="text-paper/70 text-sm mt-1">{t.via} {t.num} · {t.cp} Madrid</p>
              </div>
              <button
                onClick={() => close(null)}
                aria-label="Cerrar"
                className="rounded-full w-9 h-9 grid place-items-center bg-white/5 hover:bg-white/10 text-paper/80 text-lg leading-none"
              >×</button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat label="Estado" value={sun?.sunNow ? '☀ Sol' : sun?.altitudeDeg && sun.altitudeDeg <= 0 ? '☾ Noche' : '⛅ Sombra'} highlight={sun?.sunNow} />
              <Stat label="Restante" value={sun ? fmtMin(sun.minutesLeft).split(' ')[0] + (sun.minutesLeft >= 60 ? 'h' : 'm') : '—'} />
              <Stat label="Mesas" value={String(t.mesas || '—')} />
            </div>

            <p className="text-paper/70 text-sm mt-3">{sun ? fmtMin(sun.minutesLeft) + ' antes del ocaso' : 'Calculando…'}</p>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-widest text-paper/60 mb-2">Ritmo solar de hoy</p>
              <SunRhythm ribbon={sun?.ribbon} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <Field k="Sillas" v={String(t.sillas || '—')} />
              <Field k="Sup. m²" v={t.superficie ? t.superficie.toString() : '—'} />
              <Field k="Ubicación" v={t.ubicacion || '—'} />
              <Field k="Periodo" v={t.periodo || '—'} />
              <Field k="Horario" v={t.horaIni && t.horaFin ? `${t.horaIni.slice(0, 5)} – ${t.horaFin.slice(0, 5)}` : '—'} />
              <Field k="Sombrillas" v={String(t.sombrillas || '—')} />
            </div>

            <div className="mt-5 flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`}
                target="_blank" rel="noreferrer"
                className="flex-1 text-center bg-sun-300 text-night-900 font-medium rounded-xl py-3 hover:bg-sun-100 transition"
              >Cómo llegar</a>
              <a
                href={`https://maps.apple.com/?daddr=${t.lat},${t.lng}`}
                target="_blank" rel="noreferrer"
                className="px-4 grid place-items-center border border-white/15 rounded-xl text-paper/80 hover:border-sun-300 hover:text-sun-300 transition"
              >Apple</a>
            </div>
            <p className="text-[10px] text-paper/40 mt-3 leading-relaxed">
              Sombras aproximadas con footprints de OpenStreetMap (altura por <em>building:levels</em> o 17 m por defecto).
              No considera mobiliario, toldos ni voladizos.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl py-3 ${highlight ? 'bg-sun-300 text-night-900' : 'bg-white/5'}`}>
      <div className="text-lg font-display leading-none">{value}</div>
      <div className={`text-[10px] uppercase tracking-widest mt-1 ${highlight ? 'text-night-900/70' : 'text-paper/50'}`}>{label}</div>
    </div>
  );
}
function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-paper/50">{k}</div>
      <div className="text-paper/90 truncate">{v}</div>
    </div>
  );
}
