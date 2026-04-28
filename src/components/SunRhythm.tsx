import { useAppStore } from '../store/useAppStore';

export function SunRhythm({ ribbon }: { ribbon: number[] | undefined }) {
  const selectedDate = useAppStore((s) => s.selectedDate);

  if (!ribbon) {
    return (
      <div>
        <div className="h-12 rounded-md ring-1 ring-white/10 bg-night-500/40 flex items-center justify-center">
          <span className="text-[11px] text-paper/50 italic">Calculando ritmo solar…</span>
        </div>
        <div className="flex justify-between text-[10px] text-paper/40 font-mono mt-1">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
        </div>
      </div>
    );
  }

  const nowIdx = Math.floor((selectedDate.getHours() * 60 + selectedDate.getMinutes()) / 30);

  return (
    <div>
      <div className="flex gap-px h-12 rounded-md overflow-hidden ring-1 ring-white/10">
        {ribbon.map((v, i) => {
          const c = v === 1 ? 'bg-sun-300' : v === 0 ? 'bg-night-500/70' : 'bg-night-900';
          const isNow = i === nowIdx;
          return (
            <div
              key={i}
              className={`${c} flex-1 ${isNow ? 'outline outline-2 outline-paper/80 z-10' : ''}`}
              title={`${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-paper/50 font-mono mt-1">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  );
}
