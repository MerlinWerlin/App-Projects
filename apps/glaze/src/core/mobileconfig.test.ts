import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfile,
  buildProfiles,
  splitIcons,
  estimateSize,
  estimateIconBytes,
  escapeXml,
  uuidV4,
  slugify,
  utf8Length,
  installGuide,
  removeGuide,
} from './mobileconfig.ts';
import type { WebClipIcon } from './mobileconfig.ts';

// ---- tiny plist parser (dict/array/key/string/integer/real/true/false/data) ----

type PValue = string | number | boolean | Uint8Array | PValue[] | { [k: string]: PValue };

function unescape(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g, (_, e: string) => {
    if (e === 'amp') return '&';
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
}

function parsePlist(xml: string): PValue {
  let pos = 0;
  const ws = () => {
    while (pos < xml.length && /\s/.test(xml[pos])) pos++;
  };
  const expect = (lit: string) => {
    if (!xml.startsWith(lit, pos)) throw new Error(`expected ${lit} at ${pos}: ${xml.slice(pos, pos + 30)}`);
    pos += lit.length;
  };
  const textUntil = (close: string): string => {
    const end = xml.indexOf(close, pos);
    if (end < 0) throw new Error(`missing ${close}`);
    const raw = xml.slice(pos, end);
    if (raw.includes('<')) throw new Error(`unexpected markup in text at ${pos}`);
    if (/&(?!(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);)/.test(raw)) throw new Error(`bare & at ${pos}`);
    pos = end + close.length;
    return unescape(raw);
  };
  const value = (): PValue => {
    ws();
    const m = /^<([a-z]+)(\/?)>/.exec(xml.slice(pos, pos + 20));
    if (!m) throw new Error(`expected element at ${pos}: ${xml.slice(pos, pos + 30)}`);
    pos += m[0].length;
    const [, tag, selfClose] = m;
    if (selfClose) {
      if (tag === 'true') return true;
      if (tag === 'false') return false;
      if (tag === 'array') return [];
      if (tag === 'dict') return {};
      if (tag === 'string') return '';
      throw new Error(`bad empty <${tag}/>`);
    }
    switch (tag) {
      case 'string':
        return textUntil('</string>');
      case 'integer': {
        const t = textUntil('</integer>').trim();
        if (!/^-?\d+$/.test(t)) throw new Error(`bad integer ${t}`);
        return Number(t);
      }
      case 'real':
        return Number(textUntil('</real>').trim());
      case 'data': {
        const t = textUntil('</data>').replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('bad base64');
        return new Uint8Array(Buffer.from(t, 'base64'));
      }
      case 'array': {
        const arr: PValue[] = [];
        for (;;) {
          ws();
          if (xml.startsWith('</array>', pos)) {
            pos += 8;
            return arr;
          }
          arr.push(value());
        }
      }
      case 'dict': {
        const d: { [k: string]: PValue } = {};
        for (;;) {
          ws();
          if (xml.startsWith('</dict>', pos)) {
            pos += 7;
            return d;
          }
          expect('<key>');
          const k = textUntil('</key>');
          if (k in d) throw new Error(`duplicate key ${k}`);
          d[k] = value();
        }
      }
      default:
        throw new Error(`unknown tag <${tag}>`);
    }
  };
  expect('<?xml version="1.0" encoding="UTF-8"?>');
  ws();
  expect('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">');
  ws();
  expect('<plist version="1.0">');
  const root = value();
  ws();
  expect('</plist>');
  ws();
  if (pos !== xml.length) throw new Error('trailing content');
  return root;
}

type Dict = { [k: string]: PValue };

// ---- fixtures ----

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function fakePng(bytes: number, seed = 1): string {
  const b = Buffer.alloc(bytes);
  PNG_HEADER.copy(b);
  for (let i = PNG_HEADER.length; i < bytes; i++) b[i] = (i * 31 + seed) & 0xff;
  return b.toString('base64');
}

const icons: WebClipIcon[] = [
  { label: 'Music', url: 'music:', pngBase64: fakePng(300) },
  { label: 'Mail', url: 'message:', pngBase64: fakePng(200, 7) },
];

const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;

// ---- tests ----

test('profile is a well-formed plist with the expected structure', () => {
  const xml = buildProfile({ themeName: 'Plum Glaze', icons });
  const root = parsePlist(xml) as Dict;
  assert.equal(root.PayloadType, 'Configuration');
  assert.equal(root.PayloadVersion, 1);
  assert.equal(root.PayloadDisplayName, 'Glaze icons – Plum Glaze');
  assert.equal(root.PayloadRemovalDisallowed, false);
  assert.match(String(root.PayloadDescription), /open your apps/);
  assert.match(String(root.PayloadUUID), UUID_RE);
  assert.equal(root.PayloadIdentifier, `com.jared797.glaze.icons.plum-glaze.${root.PayloadUUID}`);
  const content = root.PayloadContent as Dict[];
  assert.equal(content.length, 2);
  const [p] = content;
  assert.equal(p.PayloadType, 'com.apple.webClip.managed');
  assert.equal(p.Label, 'Music');
  assert.equal(p.PayloadDisplayName, 'Music');
  assert.equal(p.URL, 'music:');
  assert.equal(p.IsRemovable, true);
  assert.equal(p.Precomposed, true);
  assert.equal(p.FullScreen, false);
  assert.equal(p.PayloadVersion, 1);
  assert.match(String(p.PayloadUUID), UUID_RE);
  assert.ok(String(p.PayloadIdentifier).startsWith(`${root.PayloadIdentifier}.webclip.`));
  assert.deepEqual(Buffer.from(p.Icon as Uint8Array), Buffer.from(icons[0].pngBase64, 'base64'));
});

test('custom uuid generator and identifier prefix are used', () => {
  let n = 0;
  const xml = buildProfile({
    themeName: 'X',
    icons,
    uuid: () => `ID-${++n}`,
    identifierPrefix: 'com.example.test.',
  });
  const root = parsePlist(xml) as Dict;
  assert.equal(root.PayloadUUID, 'ID-1');
  assert.equal(root.PayloadIdentifier, 'com.example.test.x.ID-1');
  assert.deepEqual((root.PayloadContent as Dict[]).map((p) => p.PayloadUUID), ['ID-2', 'ID-3']);
});

test('empty icon list still parses', () => {
  const root = parsePlist(buildProfile({ themeName: '', icons: [] })) as Dict;
  assert.deepEqual(root.PayloadContent, []);
  assert.equal(root.PayloadDisplayName, 'Glaze icons – Custom');
});

test('escapes & < > quotes and keeps emoji; values round-trip', () => {
  assert.equal(escapeXml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f');
  const tricky: WebClipIcon[] = [
    { label: `Tom & Jerry's <"Best">`, url: 'app://x?a=1&b=<2>', pngBase64: fakePng(50) },
    { label: '🎵 Música 👩‍💻', url: 'music:', pngBase64: fakePng(50) },
    { label: 'Bell\u0007Ctl\uD800', url: 'x:', pngBase64: fakePng(50) },
  ];
  const theme = `Rock & "Roll" <3 🌙`;
  const xml = buildProfile({ themeName: theme, icons: tricky });
  assert.ok(!xml.includes('Tom & Jerry'));
  const root = parsePlist(xml) as Dict;
  assert.equal(root.PayloadDisplayName, `Glaze icons – ${theme}`);
  const content = root.PayloadContent as Dict[];
  assert.equal(content[0].Label, `Tom & Jerry's <"Best">`);
  assert.equal(content[0].URL, 'app://x?a=1&b=<2>');
  assert.equal(content[1].Label, '🎵 Música 👩‍💻');
  assert.equal(content[2].Label, 'BellCtl'); // control char and lone surrogate dropped
  assert.match(String(root.PayloadIdentifier), /^com\.jared797\.glaze\.icons\.rock-roll-3\./);
});

test('UUIDs are RFC 4122 v4 and unique across a profile and many calls', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const u = uuidV4();
    assert.match(u, UUID_RE);
    seen.add(u);
  }
  assert.equal(seen.size, 2000);
  // Math.random-style fallback path via injected bytes still sets version/variant bits
  assert.match(uuidV4((n) => new Uint8Array(n).fill(0xff)), UUID_RE);
  const many = Array.from({ length: 30 }, (_, i) => ({ label: `A${i}`, url: `a${i}:`, pngBase64: fakePng(20) }));
  const root = parsePlist(buildProfile({ themeName: 'U', icons: many })) as Dict;
  const ids = [root.PayloadUUID, ...(root.PayloadContent as Dict[]).map((p) => p.PayloadUUID)];
  const pids = [root.PayloadIdentifier, ...(root.PayloadContent as Dict[]).map((p) => p.PayloadIdentifier)];
  assert.equal(new Set(ids).size, 31);
  assert.equal(new Set(pids).size, 31);
});

test('size estimate tracks the real byte size', () => {
  const xml = buildProfile({ themeName: 'Plum', icons });
  const real = utf8Length(xml);
  const est = estimateSize(icons, 'Plum');
  assert.ok(est >= real, `estimate ${est} < real ${real}`);
  assert.ok(est - real < 400, `estimate ${est} too far above ${real}`);
  assert.equal(utf8Length('é🎵a'), Buffer.byteLength('é🎵a'));
});

test('splitIcons keeps order, respects the limit and isolates oversized icons', () => {
  const big = Array.from({ length: 10 }, (_, i) => ({ label: `App ${i}`, url: `a${i}:`, pngBase64: fakePng(400_000, i) }));
  const groups = splitIcons(big); // ~533 KB base64 each → 4 per 2.5 MB profile
  assert.deepEqual(groups.map((g) => g.length), [4, 4, 2]);
  assert.deepEqual(groups.flat().map((i) => i.label), big.map((i) => i.label));
  const limit = 2.5 * 1024 * 1024;
  for (const g of groups) {
    assert.ok(utf8Length(buildProfile({ themeName: 'Custom', icons: g })) <= limit);
  }
  // a single icon larger than the limit gets its own group
  const small = { label: 's', url: 's:', pngBase64: fakePng(100) };
  const huge = { label: 'h', url: 'h:', pngBase64: fakePng(5000) };
  const max = estimateIconBytes(small) * 3;
  assert.deepEqual(splitIcons([small, huge, small], max).map((g) => g.map((i) => i.label)), [['s'], ['h'], ['s']]);
  assert.deepEqual(splitIcons([]), []);
  assert.equal(splitIcons(icons).length, 1);
});

test('buildProfiles names files and display names per part', () => {
  const big = Array.from({ length: 6 }, (_, i) => ({ label: `App ${i}`, url: `a${i}:`, pngBase64: fakePng(400_000, i) }));
  const files = buildProfiles({ themeName: 'Plum Glaze', icons: big });
  assert.deepEqual(files.map((f) => f.filename), ['Glaze-plum-glaze-1-of-2.mobileconfig', 'Glaze-plum-glaze-2-of-2.mobileconfig']);
  const roots = files.map((f) => parsePlist(f.xml) as Dict);
  assert.equal(roots[0].PayloadDisplayName, 'Glaze icons – Plum Glaze (1 of 2)');
  assert.equal(roots[1].PayloadDisplayName, 'Glaze icons – Plum Glaze (2 of 2)');
  assert.notEqual(roots[0].PayloadIdentifier, roots[1].PayloadIdentifier);
  assert.equal(roots.reduce((n, r) => n + (r.PayloadContent as Dict[]).length, 0), 6);
  const single = buildProfiles({ themeName: 'Plum Glaze', icons });
  assert.equal(single.length, 1);
  assert.equal(single[0].filename, 'Glaze-plum-glaze.mobileconfig');
  assert.equal((parsePlist(single[0].xml) as Dict).PayloadDisplayName, 'Glaze icons – Plum Glaze');
});

test('slugify', () => {
  assert.equal(slugify('Crème Brûlée!'), 'creme-brulee');
  assert.equal(slugify('🌙🌙'), 'theme');
});

test('install and remove guides', () => {
  const install = installGuide();
  assert.ok(install.some((s) => s.includes('Not Verified')));
  assert.ok(installGuide(2).length === install.length + 1);
  const remove = removeGuide().join(' ');
  assert.match(remove, /Settings > General > VPN & Device Management/);
  assert.match(remove, /Remove Profile/);
});
