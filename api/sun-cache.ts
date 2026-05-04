import type { VercelRequest, VercelResponse } from '@vercel/node';

const OWNER = process.env.GITHUB_OWNER || 'Ntizar';
const REPO = process.env.GITHUB_REPO || 'solmad';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = process.env.SUN_CACHE_PATH || 'data/sun-cache.json';
const TOKEN = process.env.GITHUB_TOKEN || process.env.SOLMAD_GITHUB_TOKEN;
const CONTENTS_PATH = FILE_PATH.split('/').map(encodeURIComponent).join('/');

interface Row {
  id: number;
  key: string;
  sunNow: boolean;
  altitudeDeg: number;
  azimuthDeg: number;
  minutesLeft: number;
  directMinutes: number;
  ribbon?: number[];
  updatedAt: string;
}

function fail(res: VercelResponse, code: number, error: string) {
  return res.status(code).json({ error });
}

function encodeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeBase64(value: string) {
  return Buffer.from(value, 'base64').toString('utf8');
}

async function github(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { res, data };
}

async function readRows() {
  const get = await github(`/contents/${CONTENTS_PATH}?ref=${encodeURIComponent(BRANCH)}`);
  if (get.res.ok && get.data?.content) {
    return { sha: get.data.sha as string, rows: JSON.parse(decodeBase64(get.data.content)) as Row[] };
  }
  if (get.res.status === 404) return { sha: undefined, rows: [] as Row[] };
  throw new Error('GitHub read failed');
}

function validRow(row: any): row is Row {
  return row && Number.isInteger(row.id) && typeof row.key === 'string'
    && typeof row.sunNow === 'boolean'
    && Number.isFinite(row.altitudeDeg)
    && Number.isFinite(row.azimuthDeg)
    && Number.isFinite(row.minutesLeft)
    && Number.isFinite(row.directMinutes);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!TOKEN) return fail(res, 500, 'Falta SOLMAD_GITHUB_TOKEN en Vercel');

  if (req.method === 'GET') {
    const keys = String(req.query.keys || '').split(',').filter(Boolean).slice(0, 80);
    if (keys.length === 0) return res.status(200).json({ rows: [] });
    const { rows } = await readRows();
    const wanted = new Set(keys);
    return res.status(200).json({ rows: rows.filter((row) => wanted.has(row.key)) });
  }

  if (req.method !== 'POST') return fail(res, 405, 'Metodo no permitido');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const incoming = Array.isArray(body.rows) ? body.rows.filter(validRow).slice(0, 40) as Row[] : [];
  if (incoming.length === 0) return fail(res, 400, 'Sin filas validas');

  const { sha, rows } = await readRows();
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const row of incoming) byKey.set(row.key, { ...row, updatedAt: new Date().toISOString() });
  const next = [...byKey.values()].slice(-5000);

  const put = await github(`/contents/${CONTENTS_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Update SolMad sun cache (${incoming.length})`,
      content: encodeBase64(`${JSON.stringify(next, null, 2)}\n`),
      sha,
      branch: BRANCH
    })
  });

  if (!put.res.ok) return fail(res, 502, 'GitHub no dejo guardar cache solar');
  return res.status(200).json({ ok: true, saved: incoming.length });
}
