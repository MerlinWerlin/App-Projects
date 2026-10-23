/**
 * T74 (market-1018 M2): Larger Text ui-check for the remote and its sheets.
 * Static scan (no renderer here), backed by the pure rules in src/core/textScale.ts:
 * - every Text declares how far it follows Dynamic Type (scaleRole / maxFontSizeMultiplier);
 * - no single-line Text that would truncate at large sizes (numberOfLines={1} needs
 *   adjustsFontSizeToFit; any other line limit must come from a textScale rule);
 * - no fixed heights on text containers (each fixed height is allowlisted with a reason);
 * - the reflow rules are actually used by the screens and sheets, and sheets scroll.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const tsxIn = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `${dir}/${f}`);

const FILES = [...tsxIn('src/ui/remote'), ...tsxIn('src/ui/keyboard'), 'src/ui/Sheet.tsx', 'app/(tabs)/remote.tsx'];

interface Tag {
  file: string;
  line: number;
  text: string;
}

/** Opening tags of <Text ...> and <Animated.Text ...> (not TextInput), brace-aware. */
function textTags(file: string): Tag[] {
  const src = read(file);
  const out: Tag[] = [];
  const re = /<(Animated\.)?Text(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ file, line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, i + 1) });
  }
  return out;
}

/** Text that may opt out of Dynamic Type entirely, with the reason. */
const NO_SCALING_OK: Record<string, string> = {
  'src/ui/remote/DPad.tsx': 'OK label: dpadGeometry() scales its fontSize by fontScale itself (capped at DPAD_MAX_FONT_SCALE)',
};

/**
 * Fixed heights (and aspect ratios) allowed in these files, as `file -> style key -> reason`.
 * '*' covers a whole file whose sizes all come from one geometry function.
 */
const FIXED_HEIGHT_OK: Record<string, Record<string, string>> = {
  'src/ui/remote/DPad.tsx': { '*': 'every size comes from dpadGeometry(); the OK label is capped and shrinks to fit' },
  'src/ui/remote/RemoteKey.tsx': {
    round: 'round icon / glyph key (52 pt): glyphs are capped at roleCap(glyph), which fits (textScale.test.ts)',
    rockerBtn: 'rocker half: icon only, no text',
  },
  'src/ui/remote/ColorKeys.tsx': { pill: 'colour pill: no text, hitSlop makes it 48 pt' },
  'src/ui/remote/VoiceButton.tsx': {
    mic: 'mic icon box: icon only; the label sits beside it and wraps',
    ring: 'breathing ring around the mic icon: decoration',
  },
  'src/ui/remote/Touchpad.tsx': {
    touch: 'aspect-ratio pad: its only text is the caption-capped hint, which wraps inside it',
    dot: 'swipe trail dot: decoration',
  },
  'src/ui/Sheet.tsx': {
    grabber: 'grabber bar: decoration',
    x: 'close icon button (36 pt + 6 pt hitSlop = 48 pt): icon only',
  },
  'app/(tabs)/remote.tsx': { midKey: 'Mute / 123 / Keyboard / Apps: icon-only keys' },
};

interface HeightHit {
  file: string;
  line: number;
  key: string;
  text: string;
}

/** `height:` / `aspectRatio:` entries (not min/max/lineHeight, not shadowOffset) with their style key. */
function fixedHeights(file: string): HeightHit[] {
  const lines = read(file).split('\n');
  const hits: HeightHit[] = [];
  let key = '';
  lines.forEach((raw, i) => {
    const keyMatch = /^\s*([A-Za-z_$][\w$]*):\s*\{/.exec(raw);
    if (keyMatch && keyMatch[1] !== 'shadowOffset') key = keyMatch[1]!;
    const line = raw.replace(/shadowOffset:\s*\{[^}]*\}/g, '');
    if (/(^|[^A-Za-z])(height|aspectRatio)\s*:/.test(line)) {
      // A one-line style: `name: { ... height: n }` names itself.
      const own = /^\s*([A-Za-z_$][\w$]*):\s*\{.*(height|aspectRatio)\s*:/.exec(line);
      hits.push({ file, line: i + 1, key: own ? own[1]! : key, text: raw.trim() });
    }
  });
  return hits;
}

describe('Larger Text: remote and sheets (T74)', () => {
  it('scans the remote, keyboard and sheet files', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(14);
    expect(FILES).toEqual(expect.arrayContaining(['src/ui/remote/SourceSheet.tsx', 'src/ui/keyboard/KeyboardSheet.tsx']));
    expect(FILES.flatMap(textTags).length).toBeGreaterThan(30);
  });

  it('every Text says how far it follows the text size (scaleRole or maxFontSizeMultiplier)', () => {
    const bad = FILES.flatMap(textTags)
      .filter((t) => !/\bscaleRole=|\bmaxFontSizeMultiplier=/.test(t.text))
      .filter((t) => !(/allowFontScaling=\{false\}/.test(t.text) && t.file in NO_SCALING_OK))
      .map((t) => `${t.file}:${t.line}`);
    expect(bad).toEqual([]);
  });

  it('allowFontScaling={false} only where a geometry function scales the text itself', () => {
    const bad = FILES.flatMap(textTags)
      .filter((t) => /allowFontScaling=\{false\}/.test(t.text) && !(t.file in NO_SCALING_OK))
      .map((t) => `${t.file}:${t.line}`);
    expect(bad).toEqual([]);
  });

  it('no Text is cut to one line without shrinking to fit or a reflow rule', () => {
    const bad: string[] = [];
    for (const t of FILES.flatMap(textTags)) {
      const n = /numberOfLines=\{([^}]*)\}/.exec(t.text);
      if (!n) continue;
      const value = n[1]!.trim();
      const literal = /^\d+$/.test(value);
      if (literal && !/\badjustsFontSizeToFit\b/.test(t.text)) bad.push(`${t.file}:${t.line} numberOfLines={${value}}`);
      // A computed limit must come from the textScale rules (maxLines).
      if (!literal && !/from '[^']*core\/textScale'/.test(read(t.file))) bad.push(`${t.file}:${t.line} numberOfLines={${value}} without textScale`);
    }
    expect(bad).toEqual([]);
  });

  it('no fixed heights on text containers (allowlisted with a reason)', () => {
    const bad = FILES.flatMap(fixedHeights)
      .filter((h) => {
        const ok = FIXED_HEIGHT_OK[h.file];
        return !(ok && (ok['*'] || ok[h.key]));
      })
      .map((h) => `${h.file}:${h.line} [${h.key}] ${h.text}`);
    expect(bad).toEqual([]);
  });

  it('every allowlisted fixed height still exists (no stale entries)', () => {
    for (const [file, keys] of Object.entries(FIXED_HEIGHT_OK)) {
      const found = new Set(fixedHeights(file).map((h) => h.key));
      for (const k of Object.keys(keys)) {
        if (k === '*') expect({ file, any: found.size > 0 }).toEqual({ file, any: true });
        else expect({ file, k, found: found.has(k) }).toEqual({ file, k, found: true });
      }
    }
  });

  it('the screens and sheets use the textScale rules', () => {
    const uses: Record<string, RegExp> = {
      'app/(tabs)/remote.tsx': /\browOrStack\(/,
      'src/ui/remote/SimpleRemote.tsx': /\bgridColumns\(/,
      'src/ui/remote/SourceSheet.tsx': /\bgridColumns\(/,
      'src/ui/remote/SleepTimerSheet.tsx': /\bgridColumns\(/,
      'src/ui/keyboard/KeyboardSheet.tsx': /\browOrStack\(/,
      'src/ui/remote/NumpadSheet.tsx': /\bminKeyHeight\(/,
      'src/ui/remote/TvHeader.tsx': /\bmaxLines\(/,
    };
    for (const [file, re] of Object.entries(uses)) {
      const src = read(file);
      expect({ file, imports: /from '[^']*core\/textScale'/.test(src), uses: re.test(src) }).toEqual({ file, imports: true, uses: true });
    }
    // Text maps a role to RN's maxFontSizeMultiplier.
    const text = read('src/ui/Text.tsx');
    expect(text).toMatch(/scaleRole\?: TextRole/);
    expect(text).toMatch(/maxFontSizeMultiplier: roleCap\(scaleRole\)/);
    // The d-pad keeps its own geometry and cap.
    expect(read('src/ui/remote/DPad.tsx')).toMatch(/dpadGeometry\(.*win\.fontScale\)/);
  });

  it('sheets scroll instead of clipping when their content is taller than the screen', () => {
    const sheet = read('src/ui/Sheet.tsx');
    expect(sheet).toMatch(/<ScrollView/);
    expect(sheet).toMatch(/flexShrink: 1/);
    expect(sheet).toMatch(/paddingTop: insets\.top/);
    expect(sheet).toMatch(/scroll = true/);
  });

  it('the store listing says the buttons grow with the text size (no competitor names)', () => {
    const store = read('docs/STORE.md');
    const line = store.split('\n').find((l) => /grow with your text size/i.test(l));
    expect(line).toBeDefined();
    expect(line!).not.toMatch(/Evolly|Begamob|Kraftwerk|Desidari|Zap|NSTX|Ozuna|Level Clash|TVRem|Codematics|Mobile Alchemy|Real Vision/i);
  });
});
