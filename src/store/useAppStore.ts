import { create } from 'zustand';
import type { SunState, Terraza } from '../lib/types';

interface Filters {
  distrito: string | null;
  query: string;
  minHours: number; // 0..6
  onlyOpenNow: boolean;
}

interface State {
  terrazas: Terraza[];
  // Mapa id->estado solar (full); y estado rápido por índice (sólo sunNow)
  sunStates: Map<number, SunState>;
  quickSun: Uint8Array | null;
  selectedDate: Date;        // hora "ahora mismo" o la elegida en el slider
  isLive: boolean;           // true = sigue al reloj real
  selectedId: number | null;
  hoveredId: number | null;
  filters: Filters;
  introDone: boolean;
  buildingsLoaded: boolean;
  userLocation: { lat: number; lng: number } | null;
  geoStatus: 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable';
  // setters
  setTerrazas: (t: Terraza[]) => void;
  setDate: (d: Date, live?: boolean) => void;
  setSelectedId: (id: number | null) => void;
  setHoveredId: (id: number | null) => void;
  setFilters: (p: Partial<Filters>) => void;
  setIntroDone: (v: boolean) => void;
  setBuildingsLoaded: (v: boolean) => void;
  setSunStates: (m: Map<number, SunState>) => void;
  updateSunState: (id: number, patch: Partial<SunState>) => void;
  setQuickSun: (u: Uint8Array | null) => void;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  setGeoStatus: (s: 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable') => void;
}

export const useAppStore = create<State>((set) => ({
  terrazas: [],
  sunStates: new Map(),
  quickSun: null,
  selectedDate: new Date(),
  isLive: true,
  selectedId: null,
  hoveredId: null,
  filters: { distrito: null, query: '', minHours: 0, onlyOpenNow: true },
  introDone: false,
  buildingsLoaded: false,
  userLocation: null,
  geoStatus: 'idle',
  setTerrazas: (terrazas) => set({ terrazas }),
  setDate: (d, live = false) => set({ selectedDate: d, isLive: live }),
  setSelectedId: (id) => set({ selectedId: id }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  setIntroDone: (v) => set({ introDone: v }),
  setBuildingsLoaded: (v) => set({ buildingsLoaded: v }),
  setSunStates: (m) => set({ sunStates: m }),
  updateSunState: (id, patch) => set((s) => {
    const cur = s.sunStates.get(id);
    if (!cur) return s;
    const next = new Map(s.sunStates);
    next.set(id, { ...cur, ...patch });
    return { sunStates: next };
  }),
  setQuickSun: (u) => set({ quickSun: u }),
  setUserLocation: (loc) => set({ userLocation: loc }),
  setGeoStatus: (s) => set({ geoStatus: s })
}));
