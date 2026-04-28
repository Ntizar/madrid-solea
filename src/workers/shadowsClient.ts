import * as Comlink from 'comlink';
import type { ShadowAPI } from './shadows.worker';

let _api: Comlink.Remote<ShadowAPI> | null = null;

export function shadowsApi(): Comlink.Remote<ShadowAPI> {
  if (_api) return _api;
  const worker = new Worker(new URL('./shadows.worker.ts', import.meta.url), { type: 'module' });
  _api = Comlink.wrap<ShadowAPI>(worker);
  return _api;
}
