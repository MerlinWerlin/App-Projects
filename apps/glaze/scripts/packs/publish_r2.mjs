#!/usr/bin/env node
// T159 (owner-1030 A3): upload dist/packs to Cloudflare R2 through its S3-compatible API.
//
//   node scripts/packs/publish_r2.mjs [--dir dist/packs] [--dry-run]
//
// Env (or an optional .env in the app folder, never committed): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET. Endpoint https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com,
// region "auto", path-style /<bucket>/<key>, SigV4 signed by scripts/packs/sigv4.mjs (no SDK).
// (R2_ENDPOINT overrides the endpoint; the tests point it at a local mock server.)
//
// Order: every pack file, then each manifest.json, then catalog.json LAST, so a phone never sees
// a catalogue entry or manifest whose files are missing. Cache-Control: everything under art/
// (content-hashed files and versioned manifests) "public, max-age=31536000, immutable";
// catalog.json "public, max-age=300". Objects whose HEAD already shows the same size, ETag (MD5)
// and Cache-Control are skipped, so re-running is cheap. A versioned manifest that already exists
// with different bytes is an error (bump the version; see scripts/packs/versions.json). After the
// upload every object is HEAD-verified (status, size, content type). --dry-run prints the plan,
// needs no env and makes no network calls. Secrets are never printed.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256Hex, signRequest } from './sigv4.mjs';

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
export const CACHE_CATALOG = 'public, max-age=300';
export const ENV_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// ------------------------------------------------------------------ .env

/** Tiny .env parser: KEY=VALUE lines, # comments, optional quotes, optional "export ". */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

/** process.env plus <app>/.env (real env wins). */
export function loadEnv(file = join(APP_ROOT, '.env'), base = process.env) {
  const env = { ...base };
  if (existsSync(file)) for (const [k, v] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) if (env[k] === undefined) env[k] = v;
  return env;
}

// ------------------------------------------------------------------ plan

export const contentTypeOf = (key) => TYPES[key.slice(key.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
export const cacheControlOf = (key) => (key === 'catalog.json' ? CACHE_CATALOG : CACHE_IMMUTABLE);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/**
 * The upload plan for a built dist/packs folder: [{ key, file, size, md5, contentType, cacheControl,
 * kind }] with pack files first, then manifests, then catalog.json last.
 */
export function planUpload(dir) {
  const root = resolve(dir);
  if (!existsSync(join(root, 'catalog.json'))) throw new Error(`${root}/catalog.json not found: run scripts/packs/build_packs.mjs first`);
  const files = [];
  const manifests = [];
  for (const p of existsSync(join(root, 'art')) ? walk(join(root, 'art')) : []) {
    const key = relative(root, p).split(sep).join('/');
    (key.endsWith('/manifest.json') ? manifests : files).push(key);
  }
  const entry = (key, kind) => {
    const buf = readFileSync(join(root, key));
    return { key, file: join(root, key), size: buf.length, md5: createHash('md5').update(buf).digest('hex'), contentType: contentTypeOf(key), cacheControl: cacheControlOf(key), kind };
  };
  return [...files.map((k) => entry(k, 'file')), ...manifests.map((k) => entry(k, 'manifest')), entry('catalog.json', 'catalog')];
}

// ------------------------------------------------------------------ S3 client (tiny)

export function configFromEnv(env) {
  const missing = ENV_KEYS.filter((k) => !env[k]);
  if (missing.length) throw new Error(`missing env ${missing.join(', ')} (set them or put them in .env; see docs/THEME_PACKS.md)`);
  const endpoint = env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return { endpoint: endpoint.replace(/\/+$/, ''), bucket: env.R2_BUCKET, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, region: 'auto' };
}

function redact(cfg, s) {
  let out = String(s);
  for (const secret of [cfg.secretAccessKey, cfg.accessKeyId]) if (secret) out = out.split(secret).join('***');
  return out;
}

function rawRequest(url, method, headers, body) {
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((res, rej) => {
    const req = lib.request(url, { method, headers }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(60_000, () => req.destroy(new Error('request timed out')));
    req.on('error', rej);
    req.end(body);
  });
}

/** One signed S3 request with 3 attempts on network errors, 429 and 5xx. */
export async function s3(cfg, method, key, { body, headers = {} } = {}) {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const payloadHash = body ? sha256Hex(body) : sha256Hex('');
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const signed = signRequest({
      method,
      path: `/${cfg.bucket}/${key}`,
      headers: { host: url.host, ...headers, ...(body ? { 'content-length': String(body.length) } : {}) },
      payloadHash,
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });
    try {
      const r = await rawRequest(url, method, signed.headers, body);
      if (r.status !== 429 && r.status < 500) return r;
      last = new Error(`${method} ${key}: HTTP ${r.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((ok) => setTimeout(ok, 300 * attempt * attempt));
  }
  throw new Error(redact(cfg, last instanceof Error ? last.message : last));
}

const etagOf = (h) => String(h.etag ?? '').replace(/"/g, '').toLowerCase();

// ------------------------------------------------------------------ publish

/** Upload (or with dryRun just print) the plan. Returns { plan, uploaded, skipped, verified }. */
export async function publish({ dir = join(APP_ROOT, 'dist', 'packs'), dryRun = false, env = loadEnv(), log = console.log } = {}) {
  const plan = planUpload(dir);
  const total = plan.reduce((a, b) => a + b.size, 0);
  if (dryRun) {
    log(`dry run: ${plan.length} object(s), ${(total / 1e6).toFixed(2)} MB to bucket ${env.R2_BUCKET || '<R2_BUCKET unset>'}; no network`);
    for (const p of plan) log(`  PUT ${p.key}  ${p.size} B  ${p.contentType}  "${p.cacheControl}"`);
    return { plan, uploaded: [], skipped: [], verified: 0 };
  }
  const cfg = configFromEnv(env);
  log(`publishing ${plan.length} object(s), ${(total / 1e6).toFixed(2)} MB to R2 bucket ${cfg.bucket}`);
  const uploaded = [];
  const skipped = [];
  for (const p of plan) {
    const head = await s3(cfg, 'HEAD', p.key);
    if (head.status === 200) {
      const same = Number(head.headers['content-length']) === p.size && etagOf(head.headers) === p.md5;
      const sameCache = !head.headers['cache-control'] || head.headers['cache-control'] === p.cacheControl;
      if (same && sameCache) {
        skipped.push(p.key);
        continue;
      }
      if (!same && p.kind === 'manifest') {
        throw new Error(`${p.key} is already published with different content; versioned folders are immutable. Rebuild so the pack gets a new version (keep scripts/packs/versions.json committed).`);
      }
    } else if (head.status !== 404) {
      throw new Error(`HEAD ${p.key}: HTTP ${head.status}`);
    }
    const body = readFileSync(p.file);
    const r = await s3(cfg, 'PUT', p.key, {
      body,
      headers: { 'content-type': p.contentType, 'cache-control': p.cacheControl, 'content-md5': Buffer.from(p.md5, 'hex').toString('base64') },
    });
    if (r.status !== 200) throw new Error(`PUT ${p.key}: HTTP ${r.status} ${redact(cfg, r.body.slice(0, 300))}`);
    uploaded.push(p.key);
    log(`  put  ${p.key} (${p.size} B)`);
  }
  log(`uploaded ${uploaded.length}, unchanged ${skipped.length}; verifying`);
  let verified = 0;
  for (const p of plan) {
    const h = await s3(cfg, 'HEAD', p.key);
    const type = String(h.headers['content-type'] ?? '');
    if (h.status !== 200 || Number(h.headers['content-length']) !== p.size || !type.startsWith(p.contentType)) {
      throw new Error(`verify ${p.key}: HTTP ${h.status}, ${h.headers['content-length']} B, ${type || 'no content-type'} (want ${p.size} B ${p.contentType})`);
    }
    verified++;
  }
  log(`verified ${verified} object(s)`);
  return { plan, uploaded, skipped, verified };
}

// ------------------------------------------------------------------ CLI

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  let dir;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--dir') dir = resolve(args[++i] ?? '');
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('usage: node scripts/packs/publish_r2.mjs [--dir dist/packs] [--dry-run]');
      process.exit(0);
    } else {
      console.error(`unknown option ${args[i]}`);
      process.exit(2);
    }
  }
  try {
    await publish({ dir, dryRun });
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
