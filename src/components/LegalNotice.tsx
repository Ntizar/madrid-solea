import { useEffect, useState } from 'react';

const LEGAL_KEY = 'solmad:legalSeen:v1';

export function LegalNotice() {
  const [open, setOpen] = useState(false);

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
        <div className="fixed inset-0 z-[60] bg-night-900/70 backdrop-blur-sm grid place-items-center px-4">
          <div className="w-full max-w-md rounded-3xl bg-paper text-night-900 shadow-2xl border border-night-900/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-night-900/55">Aviso legal soleado</p>
                <h2 className="font-display text-3xl mt-1">Nosotros ponemos el mapa, el sol decide</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="w-9 h-9 rounded-full bg-night-900/5 hover:bg-night-900/10 grid place-items-center shrink-0"
                aria-label="Cerrar aviso legal"
              >×</button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-night-900/75">
              SolMAD calcula sombras con datos publicos, OpenStreetMap y bastante fe en que los edificios se comporten. No nos hacemos responsables de toldos rebeldes, arboles con complejo de rascacielos, terrazas que cambian precios ni camareros que miden la caña con criterio poetico.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-night-900/75">
              Si un dato falla, aportalo y lo mejoramos. Si el sol falla, eso ya es cosa del departamento de astros.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-5 w-full rounded-full bg-sun-300 text-night-900 font-medium py-3 hover:bg-sun-100 transition"
            >
              Acepto el riesgo de perseguir terrazas al sol
            </button>
          </div>
        </div>
      )}
    </>
  );
}
