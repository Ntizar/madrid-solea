import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { SunRhythm } from './SunRhythm';
import { ribbonApi } from '../workers/shadowsClient';

function fmtHM(min: number) {
  if (min <= 0) return '0 min';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

function addMinToDate(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

export function DetailPanel() {
  const id = useAppStore((s) => s.selectedId);
  const terrazas = useAppStore((s) => s.terrazas);
  const sunStates = useAppStore((s) => s.sunStates);
  const buildingsLoaded = useAppStore((s) => s.buildingsLoaded);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const updateSunState = useAppStore((s) => s.updateSunState);
  const close = useAppStore((s) => s.setSelectedId);

  const t = id != null ? terrazas.find((x) => x.id === id) : null;
  const sun = id != null ? sunStates.get(id) : undefined;

  // Cargar ribbon bajo demanda al abrir el detalle (o al cambiar fecha)
  useEffect(() => {
    if (!t || !buildingsLoaded) return;
    if (sun?.ribbon) return;
    let cancelled = false;
    (async () => {
      try {
        const api = ribbonApi();
        const r = await api.ribbonFor(t, selectedDate.toISOString());
        if (!cancelled) updateSunState(t.id, { ribbon: r });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ribbon] error', err);
      }
    })();
    return () => { cancelled = true; };
  }, [t, sun?.ribbon, buildingsLoaded, selectedDate, updateSunState]);

  // Estado humano
  const status = (() => {
    if (!sun) return { tag: '⏳ Calculando', cls: 'bg-white/5 text-paper' };
    if (sun.altitudeDeg <= 0) return { tag: '☾ Noche', cls: 'bg-night-500/40 text-paper' };
    if (sun.sunNow) return { tag: '☀ Sol ahora', cls: 'bg-sun-300 text-night-900' };
    return { tag: '⛅ Sombra', cls: 'bg-night-500/40 text-paper' };
  })();

  const sunUntil = sun && sun.sunNow && sun.minutesLeft > 0
    ? addMinToDate(selectedDate, sun.minutesLeft)
    : null;

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
            md:top-0 md:right-0 md:h-full md:w-[400px]
            bottom-0 left-0 right-0 max-h-[82vh] md:max-h-none
            md:rounded-none rounded-t-3xl shadow-2xl overflow-hidden flex flex-col
          "
        >
          <div className="md:hidden flex justify-center py-2">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>
          <div className="px-5 pb-5 overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pt-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-sun-300/90 truncate">{t.distrito} · {t.barrio}</p>
                <h2 className="font-display text-3xl leading-tight mt-1 break-words">{t.name}</h2>
                <p className="text-paper/70 text-sm mt-1">{t.via} {t.num} · {t.cp} Madrid</p>
              </div>
              <button
                onClick={() => close(null)}
                aria-label="Cerrar"
                className="rounded-full w-9 h-9 grid place-items-center bg-white/5 hover:bg-white/10 text-paper/80 text-lg leading-none shrink-0"
              >×</button>
            </div>

            {/* Bloque grande: estado actual */}
            <div className={`mt-5 rounded-2xl px-4 py-4 ${status.cls}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl">{status.tag}</span>
                {sun && sun.sunNow && (
                  <span className="font-mono text-lg tabular-nums">{fmtHM(sun.minutesLeft)}</span>
                )}
              </div>
              <p className={`text-sm mt-1 ${status.cls.includes('night-900') ? 'text-night-900/75' : 'text-paper/75'}`}>
                {!sun && 'Calculando sombras de los edificios cercanos…'}
                {sun && !sun.sunNow && sun.altitudeDeg > 0 && sun.minutesLeft > 0 && (
                  <>Ahora a la sombra. Hoy aún tendrá <strong>{fmtHM(sun.minutesLeft)}</strong> de sol.</>
                )}
                {sun && !sun.sunNow && sun.altitudeDeg > 0 && sun.minutesLeft === 0 && (
                  <>A la sombra. No le da más sol antes del ocaso.</>
                )}
                {sun && sun.altitudeDeg <= 0 && 'El sol ya se ha puesto (o aún no ha salido).'}
                {sun && sun.sunNow && sunUntil && (
                  <>Sol directo hasta aprox. <strong>{fmtTime(sunUntil)}</strong>.</>
                )}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-widest text-paper/60 mb-2">Ritmo solar de hoy</p>
              <SunRhythm ribbon={sun?.ribbon} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
              <Field k="Mesas" v={String(t.mesas || '—')} />
              <Field k="Sillas" v={String(t.sillas || '—')} />
              <Field k="Sup. m²" v={t.superficie ? t.superficie.toString() : '—'} />
              <Field k="Ubicación" v={t.ubicacion || '—'} />
              <Field k="Periodo" v={t.periodo || '—'} />
              <Field k="Sombrillas" v={String(t.sombrillas || '—')} />
            </div>
            <div className="mt-2">
              <Field k="Horario" v={t.horaIni && t.horaFin ? `${t.horaIni.slice(0, 5)} – ${t.horaFin.slice(0, 5)}` : '—'} />
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=walking`}
              target="_blank" rel="noreferrer"
              className="mt-5 block text-center bg-sun-300 text-night-900 font-medium rounded-xl py-3.5 hover:bg-sun-100 transition shadow-glow"
            >🚶 Cómo llegar (Google Maps)</a>

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

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-paper/50">{k}</div>
      <div className="text-paper/90 truncate">{v}</div>
    </div>
  );
}
