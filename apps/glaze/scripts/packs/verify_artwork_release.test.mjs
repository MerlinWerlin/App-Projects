import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { digest } from './append_artwork.mjs';
import { verifyArtworkRelease } from './verify_artwork_release.mjs';

test('preflight protects existing immutable bytes; postflight checks uploads including the catalogue', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'glaze-public-check-'));
  try {
    const existingDir = join(dir, 'existing'); mkdirSync(existingDir);
    const tag = 'glaze-packs-v18'; mkdirSync(join(dir, tag)); writeFileSync(join(dir, 'tags.txt'), tag + '\n');
    const bytes = Buffer.from('reviewed bytes');
    const assets = [
      { name: 'old.webp', kind: 'file', upload: false, size: bytes.length, sha256: digest(bytes) },
      { name: 'new.webp', kind: 'file', upload: true, size: bytes.length, sha256: digest(bytes) },
      { name: 'catalog.json', kind: 'catalog', upload: true, size: bytes.length, sha256: digest(bytes) },
    ];
    writeFileSync(join(dir, tag, 'plan.json'), JSON.stringify({ assets }));
    writeFileSync(join(existingDir, tag + '.json'), JSON.stringify({ assets: [{ name: 'old.webp', size: bytes.length }, { name: 'catalog.json', size: 100 }] }));
    const urls = [], fetcher = async (url) => { urls.push(url); return { ok: true, arrayBuffer: async () => bytes }; };
    assert.deepEqual(await verifyArtworkRelease({ dir, existingDir, fetcher, log: () => {} }), { verified: 1 });
    assert.ok(urls[0].endsWith('/old.webp'));
    urls.length = 0;
    assert.deepEqual(await verifyArtworkRelease({ dir, uploadedOnly: true, fetcher, log: () => {} }), { verified: 2 });
    assert.ok(urls.some((u) => /catalog\.json\?verify=\d+/.test(u)));
    await assert.rejects(verifyArtworkRelease({ dir, existingDir, attempts: 1, fetcher: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('different bytes') }), log: () => {} }), /must not be overwritten/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('publication workflow is manual, defaults to dry run and never clobbers immutable files', () => {
  const yaml = readFileSync(new URL('../../../../.github/workflows/glaze-publish-packs.yml', import.meta.url), 'utf8');
  assert.match(yaml, /workflow_dispatch:/); assert.match(yaml, /dry_run:[\s\S]*?default: true/);
  assert.doesNotMatch(yaml, /^\s+(push|pull_request):/m);
  assert.match(yaml, /artwork_progress\.mjs --complete/); assert.match(yaml, /build_packs\.mjs[^\n]*--complete/);
  assert.match(yaml, /if \[ "\$file" = catalog\.json \]; then[\s\S]*?gh release upload "\$tag" --clobber/);
  assert.match(yaml, /Catalogue changed during uploads/);
  assert.equal((yaml.match(/--clobber/g) ?? []).length, 1);
  assert.match(yaml, /catalog-tag glaze-packs-v5/);
});
