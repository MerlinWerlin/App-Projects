#!/usr/bin/env node
// Glaze 1.0.37: check every uploaded pack object over the PUBLIC pack URL (the address phones use),
// after scripts/packs/publish_r2.mjs has put them in the bucket.
//
//   node scripts/packs/verify_r2_public.mjs --dir dist/artwork-packs --base https://pub-….r2.dev [--concurrency 4]
//
// For every object of planUpload(dir) (pack files, manifests, catalog.json), in that order:
//  - HEAD: 200, the exact Content-Length, the expected Content-Type and Cache-Control.
//  - GET: the body's SHA-256 equals the local file's.
// catalog.json is requested with a cache-busting query so a CDN copy can't hide a stale catalogue.
// 429 and 5xx are retried with backoff (the r2.dev URL is rate-limited). Needs no secrets.
// Prints a count + size summary; exits 1 on the first object that fails after retries.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planUpload } from './publish_r2.mjs';
import { packObjectUrl } from '../../src/core/packHost.ts';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** fetch with retries on network errors, 429 and 5xx. */
async function fetchRetry(fetcher, url, init, attempts, backoffMs) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetcher(url, { ...init, signal: AbortSignal.timeout(90_000) });
      if (r.status !== 429 && r.status < 500) return r;
      last = new Error(`HTTP ${r.status}`);
      await r.arrayBuffer().catch(() => undefined);
    } catch (e) {
      last = e;
    }
    if (i < attempts - 1) await sleep(backoffMs * (i + 1) * (i + 1));
  }
  throw last;
}

/** The public URL of a plan key (catalog.json gets a cache-busting query). */
export function publicUrl(base, key, now = Date.now()) {
  const url = packObjectUrl(base, key);
  return key === 'catalog.json' ? `${url}?verify=${now}` : url;
}

export async function verifyPublic({ dir, base, concurrency = 4, fetcher = fetch, attempts = 6, backoffMs = 1000, log = console.log }) {
  if (!/^https?:\/\//i.test(String(base ?? ''))) throw new Error('--base must be the public http(s) pack URL');
  const plan = planUpload(dir);
  const totalBytes = plan.reduce((n, p) => n + p.size, 0);
  let next = 0;
  let done = 0;
  let failure = null;
  const one = async (p) => {
    const url = publicUrl(base, p.key);
    const head = await fetchRetry(fetcher, url, { method: 'HEAD' }, attempts, backoffMs);
    const len = Number(head.headers.get('content-length'));
    const type = String(head.headers.get('content-type') ?? '');
    const cache = String(head.headers.get('cache-control') ?? '');
    if (head.status !== 200) throw new Error(`${p.key}: HEAD HTTP ${head.status}`);
    if (len !== p.size) throw new Error(`${p.key}: HEAD Content-Length ${len}, want ${p.size}`);
    if (!type.startsWith(p.contentType)) throw new Error(`${p.key}: Content-Type "${type}", want ${p.contentType}`);
    if (cache !== p.cacheControl) throw new Error(`${p.key}: Cache-Control "${cache}", want "${p.cacheControl}"`);
    const get = await fetchRetry(fetcher, url, {}, attempts, backoffMs);
    if (get.status !== 200) throw new Error(`${p.key}: GET HTTP ${get.status}`);
    const body = Buffer.from(await get.arrayBuffer());
    const want = sha256(readFileSync(p.file));
    if (body.length !== p.size || sha256(body) !== want) throw new Error(`${p.key}: public bytes differ from the build (${body.length} B)`);
  };
  const worker = async () => {
    while (!failure && next < plan.length) {
      const p = plan[next++];
      try {
        await one(p);
      } catch (e) {
        failure ??= e;
        return;
      }
      done++;
      if (done % 200 === 0 || done === plan.length) log(`verified ${done}/${plan.length} public objects`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, plan.length)) }, worker));
  if (failure) throw failure;
  const summary = { objects: plan.length, bytes: totalBytes, manifests: plan.filter((p) => p.kind === 'manifest').length, files: plan.filter((p) => p.kind === 'file').length };
  log(`all ${summary.objects} objects match at ${base} (${(totalBytes / 1e6).toFixed(2)} MB)`);
  return summary;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const get = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  try {
    await verifyPublic({ dir: resolve(get('--dir') ?? 'dist/packs'), base: get('--base'), concurrency: Number(get('--concurrency') ?? 4) });
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
