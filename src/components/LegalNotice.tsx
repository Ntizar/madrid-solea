import { useEffect, useState } from 'react';

const LEGAL_KEY = 'solmad:legalSeen:v1';

export function LegalNotice() {
  const [open, setOpen] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LEGAL_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = () => {
    try { localStorage.setItem(LEGAL_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-paper/55 hover:text-paper/85 transition tracking-wide font-display"
      >
        Letra pequeña, sombra grande
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-night-900/60 backdrop-blur-sm grid place-items-end sm:place-items-center px-3 sm:px-4 pb-safe">
          <div
            onTouchStart={(e) => setDragStart(e.touches[0]?.clientY ?? null)}
            onTouchEnd={(e) => {
              const end = e.changedTouches[0]?.clientY;
              if (dragStart != null && end - dragStart > 60) close();
              setDragStart(null);
            }}
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-paper text-night-900 shadow-2xl border border-night-900/10 p-4 sm:p-5"
          >
            <div className="sm:hidden mx-auto mb-2 h-1.5 w-10 rounded-full bg-night-900/15" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-night-900/55">Aviso legal soleado</p>
                <h2 className="font-display text-2xl mt-1">Sol con margen de error</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="w-9 h-9 rounded-full bg-night-900/5 hover:bg-night-900/10 grid place-items-center shrink-0"
                aria-label="Cerrar aviso legal"
              >×</button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-night-900/75">
              Calculamos sombras con datos publicos y buena voluntad. Toldos, arboles, precios mutantes y camareros poeticos no entran en garantia. Si falla, aportalo y lo afinamos.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full rounded-full bg-sun-300 text-night-900 font-medium py-3 hover:bg-sun-100 transition"
            >
              Entendido, voy al sol
            </button>
            <p className="sm:hidden mt-2 text-center text-[10px] text-night-900/40">Tambien puedes deslizar hacia abajo para cerrar.</p>
          </div>
        </div>
      )}
    </>
  );
}
