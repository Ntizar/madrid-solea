import type { VercelRequest, VercelResponse } from '@vercel/node';

const OWNER = process.env.GITHUB_OWNER || 'Ntizar';
const REPO = process.env.GITHUB_REPO || 'solmad';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = process.env.CONTRIBUTIONS_PATH || 'data/contributions.json';
const TOKEN = process.env.GITHUB_TOKEN || process.env.SOLMAD_GITHUB_TOKEN;
const CONTENTS_PATH = FILE_PATH.split('/').map(encodeURIComponent).join('/');

interface Contribution {
  id: string;
  terraceId: number;
  terraceName: string;
  contributorName: string;
  beerBrand: string;
  price: number;
  comment?: string;
  createdAt: string;
}

function cleanText(value: unknown, max = 140) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Metodo no permitido');
  if (!TOKEN) return fail(res, 500, 'Falta SOLMAD_GITHUB_TOKEN en Vercel');

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const terraceId = Number(body.terraceId);
  const price = Number(body.price);
  const contribution: Contribution = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    terraceId,
    terraceName: cleanText(body.terraceName, 120),
    contributorName: cleanText(body.contributorName, 60),
    beerBrand: cleanText(body.beerBrand, 60),
    price: Math.round(price * 100) / 100,
    comment: cleanText(body.comment, 140) || undefined,
    createdAt: new Date().toISOString()
  };

  if (!Number.isInteger(contribution.terraceId) || contribution.terraceId <= 0) return fail(res, 400, 'Terraza invalida');
  if (!contribution.terraceName || !contribution.contributorName || !contribution.beerBrand) return fail(res, 400, 'Faltan nombre, terraza o marca');
  if (!Number.isFinite(contribution.price) || contribution.price <= 0 || contribution.price > 20) return fail(res, 400, 'Precio invalido');

  const get = await github(`/contents/${CONTENTS_PATH}?ref=${encodeURIComponent(BRANCH)}`);
  let sha: string | undefined;
  let rows: Contribution[] = [];
  if (get.res.ok && get.data?.content) {
    sha = get.data.sha;
    rows = JSON.parse(decodeBase64(get.data.content)) as Contribution[];
    if (!Array.isArray(rows)) rows = [];
  } else if (get.res.status !== 404) {
    return fail(res, 502, 'GitHub no dejo leer los aportes');
  }

  rows.push(contribution);
  const put = await github(`/contents/${CONTENTS_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add SolMad contribution for terraza ${contribution.terraceId}`,
      content: encodeBase64(`${JSON.stringify(rows, null, 2)}\n`),
      sha,
      branch: BRANCH
    })
  });

  if (!put.res.ok) return fail(res, 502, 'GitHub no dejo guardar el aporte');
  return res.status(200).json({ ok: true, savedAt: contribution.createdAt });
}
