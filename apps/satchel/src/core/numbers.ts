// T148 Numbers and prices trainer: read and hear numbers in the 12 phrase languages. Pure TypeScript, fully offline,
// no tables to load: every reading is built from per-language rules.
// - spellNumber: any whole number 0-999,999 in the local language, in local script, plus a romanised reading for
//   non-Latin scripts (Hepburn for ja, with a kana line; Hanyu Pinyin with tone marks for zh, citation tones as in
//   standard orthography; Revised Romanization for ko; simple RTGS without tone marks for th; same systems as
//   src/content/phrases.json).
//   Rules worth knowing: ja / zh / ko count in 万 (10,000) units; ko uses the sino-Korean numbers (the ones for
//   prices); zh says 两 for 2 before 千 / 万 / 百 and fills gaps with 零; th has its own 10,000 and 100,000 words and
//   says เอ็ด for a final 1, ยี่ for 20; vi says mốt / lăm / lẻ; fr 70-99 (Belgium and Luxembourg: septante / nonante),
//   the -s of quatre-vingts / cents only at the end; de unit before ten (fünfundvierzig); es apocope (veintiún mil);
//   it elision (ventuno, centottanta, ventitré); pt "e" between parts (Brazil / Portugal spellings).
// - formatPrice / tillCard: an amount in a country's currency written the local way (grouping, decimal mark, symbol
//   before or after) and read out in that country's language, currency word included.
// - buildQuiz: a seeded, deterministic multiple-choice quiz (see a number in words, pick it from 4). Scores stay on
//   the phone (NUMBERS_KEY, cleaned on every read).
// Every reading is model-written: needsCheck is always true until a fluent speaker has checked the rules.
import { rng, seedFrom, shuffle } from './games.ts';
import { languageForCountry, PHRASE_LANGS, type PhraseLang, type PhraseTable } from './phrases.ts';
import { currencyDigits } from './spending.ts';
import { currencyForCountry } from './countrycurrency.ts';

export const MAX_NUMBER = 999_999;

export type NumberReading = {
  lang: PhraseLang;
  value: number;
  /** The number in words, in the language's own script. */
  text: string;
  /** Japanese only: the reading in hiragana. */
  kana: string | null;
  /** How to read it, for non-Latin scripts only. */
  roman: string | null;
  /** Model-written, not yet confirmed by a fluent speaker (always true for now). */
  needsCheck: true;
};

type Parts = { text: string; kana?: string | null; roman?: string | null };
/** Gender of the noun that follows (a currency word), or null for a bare number. */
type Noun = 'm' | 'f' | null;
type Opts = { country?: string | null; noun?: Noun };

/** Digits with a comma every three places ("12,345"), for the English side of the screen. */
export const groupedDigits = (n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Reads a typed whole number 0-999,999 (spaces, commas, dots and apostrophes as group marks are dropped); else null. */
export function parseWhole(text: string): number | null {
  const s = text.trim().replace(/[\s\u00A0\u202F,.’']/g, '');
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return isWholeInRange(n) ? n : null;
}

export const isWholeInRange = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_NUMBER;

// ---------------------------------------------------------------- Japanese

const JA_K = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const JA_H = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const JA_R = ['zero', 'ichi', 'ni', 'san', 'yon', 'go', 'roku', 'nana', 'hachi', 'kyū'];

/** 1-9999 as [kanji, kana, roman words]. */
function ja4(n: number): [string, string, string[]] {
  const th = Math.floor(n / 1000);
  const h = Math.floor(n / 100) % 10;
  const t = Math.floor(n / 10) % 10;
  const u = n % 10;
  let k = '';
  let kana = '';
  const r: string[] = [];
  if (th) {
    k += (th === 1 ? '' : JA_K[th]) + '千';
    const [hk, hr] = th === 1 ? ['せん', 'sen'] : th === 3 ? ['さんぜん', 'sanzen'] : th === 8 ? ['はっせん', 'hassen'] : [JA_H[th] + 'せん', JA_R[th] + 'sen'];
    kana += hk;
    r.push(hr);
  }
  if (h) {
    k += (h === 1 ? '' : JA_K[h]) + '百';
    const [hk, hr] =
      h === 1 ? ['ひゃく', 'hyaku'] : h === 3 ? ['さんびゃく', 'sanbyaku'] : h === 6 ? ['ろっぴゃく', 'roppyaku'] : h === 8 ? ['はっぴゃく', 'happyaku'] : [JA_H[h] + 'ひゃく', JA_R[h] + 'hyaku'];
    kana += hk;
    r.push(hr);
  }
  let last = '';
  if (t) {
    k += (t === 1 ? '' : JA_K[t]) + '十';
    kana += (t === 1 ? '' : JA_H[t]) + 'じゅう';
    last = (t === 1 ? '' : JA_R[t]) + 'jū';
  }
  if (u) {
    k += JA_K[u];
    kana += JA_H[u];
    last += JA_R[u];
  }
  if (last) r.push(last);
  return [k, kana, r];
}

function ja(n: number): Parts {
  if (n === 0) return { text: 'ゼロ', kana: null, roman: 'zero' };
  const man = Math.floor(n / 10_000);
  const rest = n % 10_000;
  let text = '';
  let kana = '';
  const roman: string[] = [];
  if (man) {
    const [k, h, r] = ja4(man);
    text += k + '万';
    kana += h + 'まん';
    roman.push(r.join('') + 'man');
  }
  if (rest) {
    const [k, h, r] = ja4(rest);
    text += k;
    kana += h;
    roman.push(...r);
  }
  return { text, kana, roman: roman.join(' ') };
}

// ---------------------------------------------------------------- Chinese (Mandarin)

const ZH_D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const ZH_P = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];

/** Joins pinyin syllables into one word, with the apostrophe before a syllable that starts with a / o / e. */
function pinyinWord(syl: string[]): string {
  let out = '';
  for (const s of syl) out += out && /^[aāáǎàoōóǒòeēéěè]/.test(s) ? `'${s}` : s;
  return out;
}

type ZhWord = { t: string; p: string[] };

/** 1-9999 as words ("两千", "四十五"); `leading`: nothing comes before (so 10-19 drop the 一). */
function zh4(n: number, trad: boolean, leading: boolean): ZhWord[] {
  const liang = trad ? '兩' : '两';
  const ds = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  const out: ZhWord[] = [];
  let started = false;
  let gap = false;
  for (let i = 0; i < 4; i++) {
    const d = ds[i];
    if (d === 0) {
      if (started) gap = true;
      continue;
    }
    if (gap) {
      out.push({ t: '零', p: ['líng'] });
      gap = false;
    }
    if (i === 0) out.push(d === 2 ? { t: liang + '千', p: ['liǎng', 'qiān'] } : { t: ZH_D[d] + '千', p: [ZH_P[d], 'qiān'] });
    else if (i === 1) out.push(d === 2 ? { t: liang + '百', p: ['liǎng', 'bǎi'] } : { t: ZH_D[d] + '百', p: [ZH_P[d], 'bǎi'] });
    else if (i === 2) out.push(d === 1 && !started && leading ? { t: '十', p: ['shí'] } : { t: ZH_D[d] + '十', p: [ZH_P[d], 'shí'] });
    else {
      const prev = out[out.length - 1];
      // Units join the tens word ("四十五" sìshíwǔ); otherwise a word of their own.
      if (prev && ds[2] !== 0) out[out.length - 1] = { t: prev.t + ZH_D[d], p: [...prev.p, ZH_P[d]] };
      else out.push({ t: ZH_D[d], p: [ZH_P[d]] });
    }
    started = true;
  }
  return out;
}

function zhWords(n: number, trad: boolean, measure: boolean): ZhWord[] {
  if (n === 0) return [{ t: '零', p: ['líng'] }];
  // A bare 2 before a measure word ("两元") is 两.
  if (n === 2 && measure) return [{ t: trad ? '兩' : '两', p: ['liǎng'] }];
  const wan = Math.floor(n / 10_000);
  const rest = n % 10_000;
  const out: ZhWord[] = [];
  if (wan) {
    const w = wan === 2 ? [{ t: trad ? '兩' : '两', p: ['liǎng'] }] : zh4(wan, trad, true);
    const last = w[w.length - 1];
    w[w.length - 1] = { t: last.t + (trad ? '萬' : '万'), p: [...last.p, 'wàn'] };
    out.push(...w);
  }
  if (rest) {
    if (wan && rest < 1000) out.push({ t: '零', p: ['líng'] });
    out.push(...zh4(rest, trad, !wan));
  }
  return out;
}

const zhParts = (w: ZhWord[]): Parts => ({ text: w.map((x) => x.t).join(''), roman: w.map((x) => pinyinWord(x.p)).join(' ') });

// ---------------------------------------------------------------- Korean (sino-Korean, the numbers for prices)

const KO_D = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const KO_R = ['yeong', 'il', 'i', 'sam', 'sa', 'o', 'yuk', 'chil', 'pal', 'gu'];

/** Revised Romanization of two syllables run together, with the sound changes numbers meet. */
function koJoin(a: string, b: string): string {
  if (!a) return b;
  if (b === 'yuk') {
    // ㄴ insertion before 육: 십육 simnyuk, 백육 baengnyuk, 천육 cheonnyuk.
    if (a.endsWith('k')) return a.slice(0, -1) + 'ng' + 'nyuk';
    if (a.endsWith('p')) return a.slice(0, -1) + 'm' + 'nyuk';
    if (a.endsWith('n') || a.endsWith('m')) return a + 'nyuk';
    if (a.endsWith('l')) return a + 'lyuk';
    return a + b;
  }
  if (/^[aeiou]/.test(b)) {
    // Final ㄱ / ㅂ carry over voiced: 십일 sibil, 백이 baegi.
    if (a.endsWith('k')) return a.slice(0, -1) + 'g' + b;
    if (a.endsWith('p')) return a.slice(0, -1) + 'b' + b;
    return a + b;
  }
  if (b.startsWith('m')) {
    // Nasal before 만: 십만 simman, 육만 yungman.
    if (a.endsWith('k')) return a.slice(0, -1) + 'ng' + b;
    if (a.endsWith('p')) return a.slice(0, -1) + 'm' + b;
  }
  return a + b;
}

/** 1-9999 as [hangul, roman chunks]. One unit word per chunk; a final digit joins the chunk before it. */
function ko4(n: number): [string, string[]] {
  const ds = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  const units: [string, string][] = [
    ['천', 'cheon'],
    ['백', 'baek'],
    ['십', 'sip'],
  ];
  let h = '';
  const r: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = ds[i];
    if (!d) continue;
    h += (d === 1 ? '' : KO_D[d]) + units[i][0];
    r.push(koJoin(d === 1 ? '' : KO_R[d], units[i][1]));
  }
  const u = ds[3];
  if (u) {
    h += KO_D[u];
    if (r.length) r[r.length - 1] = koJoin(r[r.length - 1], KO_R[u]);
    else r.push(KO_R[u]);
  }
  return [h, r];
}

function ko(n: number): Parts {
  if (n === 0) return { text: '영', roman: 'yeong' };
  const man = Math.floor(n / 10_000);
  const rest = n % 10_000;
  const text: string[] = [];
  const roman: string[] = [];
  if (man) {
    // 10,000 is plain 만 (no 일).
    const [h, r] = man === 1 ? ['', []] : ko4(man);
    text.push(h + '만');
    if (r.length) r[r.length - 1] = koJoin(r[r.length - 1], 'man');
    else r.push('man');
    roman.push(...r);
  }
  if (rest) {
    const [h, r] = ko4(rest);
    text.push(h);
    roman.push(...r);
  }
  return { text: text.join(' '), roman: roman.join(' ') };
}

// ---------------------------------------------------------------- Thai

const TH_D = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_R = ['sun', 'nueng', 'song', 'sam', 'si', 'ha', 'hok', 'chet', 'paet', 'kao'];
const TH_U: [string, string][] = [
  ['', ''],
  ['สิบ', 'sip'],
  ['ร้อย', 'roi'],
  ['พัน', 'phan'],
  ['หมื่น', 'muen'],
  ['แสน', 'saen'],
];

function th(n: number): Parts {
  if (n === 0) return { text: TH_D[0], roman: TH_R[0] };
  let text = '';
  const roman: string[] = [];
  for (let p = 5; p >= 0; p--) {
    const d = Math.floor(n / 10 ** p) % 10;
    if (!d) continue;
    if (p === 1) {
      if (d === 1) {
        text += 'สิบ';
        roman.push('sip');
      } else if (d === 2) {
        text += 'ยี่สิบ';
        roman.push('yi sip');
      } else {
        text += TH_D[d] + 'สิบ';
        roman.push(`${TH_R[d]} sip`);
      }
    } else if (p === 0) {
      // A final 1 after anything else is เอ็ด (สิบเอ็ด, ร้อยเอ็ด).
      if (d === 1 && n > 10) {
        text += 'เอ็ด';
        roman.push('et');
      } else {
        text += TH_D[d];
        roman.push(TH_R[d]);
      }
    } else {
      text += TH_D[d] + TH_U[p][0];
      roman.push(`${TH_R[d]} ${TH_U[p][1]}`);
    }
  }
  return { text, roman: roman.join(' ') };
}

// ---------------------------------------------------------------- Vietnamese

const VI_D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** 1-999; `full`: a thousands part comes before, so a missing hundred is said ("không trăm lẻ năm"). */
function vi3(n: number, full: boolean): string[] {
  const h = Math.floor(n / 100);
  const t = Math.floor(n / 10) % 10;
  const u = n % 10;
  const out: string[] = [];
  const saidHundred = h > 0 || full;
  if (saidHundred) out.push(VI_D[h], 'trăm');
  if (t === 0) {
    if (u) out.push(...(saidHundred ? ['lẻ', VI_D[u]] : [VI_D[u]]));
  } else if (t === 1) {
    out.push('mười');
    if (u) out.push(u === 5 ? 'lăm' : VI_D[u]);
  } else {
    out.push(VI_D[t], 'mươi');
    if (u) out.push(u === 1 ? 'mốt' : u === 5 ? 'lăm' : VI_D[u]);
  }
  return out;
}

function vi(n: number): Parts {
  if (n === 0) return { text: VI_D[0] };
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const out: string[] = [];
  if (th) out.push(...vi3(th, false), 'nghìn');
  if (rest) out.push(...vi3(rest, th > 0));
  return { text: out.join(' ') };
}

// ---------------------------------------------------------------- Indonesian

const ID_D = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

function id3(n: number): string[] {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const out: string[] = [];
  if (h) out.push(...(h === 1 ? ['seratus'] : [ID_D[h], 'ratus']));
  if (r === 0) return out;
  if (r < 10) out.push(ID_D[r]);
  else if (r === 10) out.push('sepuluh');
  else if (r === 11) out.push('sebelas');
  else if (r < 20) out.push(ID_D[r - 10], 'belas');
  else {
    out.push(ID_D[Math.floor(r / 10)], 'puluh');
    if (r % 10) out.push(ID_D[r % 10]);
  }
  return out;
}

function idn(n: number): Parts {
  if (n === 0) return { text: ID_D[0] };
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const out: string[] = [];
  if (th) out.push(...(th === 1 ? ['seribu'] : [...id3(th), 'ribu']));
  if (rest) out.push(...id3(rest));
  return { text: out.join(' ') };
}

// ---------------------------------------------------------------- Spanish

const ES_U = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const ES_T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ES_H = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

/** 1-999. `one`: how a final 1 is said ("uno" alone, "un" before mil or a masculine noun, "una" before a feminine one). */
function es3(n: number, one: 'uno' | 'un' | 'una'): string[] {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const fem = one === 'una';
  const out: string[] = [];
  if (h) out.push(n === 100 ? 'cien' : fem ? ES_H[h].replace(/ientos$/, 'ientas') : ES_H[h]);
  if (!r) return out;
  if (r === 1) out.push(one);
  else if (r === 21) out.push(one === 'uno' ? 'veintiuno' : one === 'un' ? 'veintiún' : 'veintiuna');
  else if (r < 30) out.push(ES_U[r]);
  else {
    const u = r % 10;
    out.push(ES_T[Math.floor(r / 10)]);
    if (u) out.push('y', u === 1 ? one : ES_U[u]);
  }
  return out;
}

function es(n: number, o: Opts): Parts {
  if (n === 0) return { text: 'cero' };
  const fem = o.noun === 'f';
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const out: string[] = [];
  if (th) out.push(...(th === 1 ? ['mil'] : [...es3(th, fem ? 'una' : 'un'), 'mil']));
  if (rest) out.push(...es3(rest, o.noun === 'm' ? 'un' : fem ? 'una' : 'uno'));
  return { text: out.join(' ') };
}

// ---------------------------------------------------------------- Portuguese

function ptUnits(european: boolean): string[] {
  return [
    'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze',
    european ? 'dezasseis' : 'dezesseis', european ? 'dezassete' : 'dezessete', 'dezoito', european ? 'dezanove' : 'dezenove',
  ];
}
const PT_T = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const PT_H = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function pt3(n: number, U: string[]): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(n === 100 ? 'cem' : PT_H[h]);
  if (r) parts.push(r < 20 ? U[r] : PT_T[Math.floor(r / 10)] + (r % 10 ? ` e ${U[r % 10]}` : ''));
  return parts.join(' e ');
}

/** Portugal, Angola, Mozambique and Cape Verde spell 16, 17 and 19 the European way. */
const PT_EUROPEAN = ['PT', 'AO', 'MZ', 'CV'];

function pt(n: number, o: Opts): Parts {
  const U = ptUnits(PT_EUROPEAN.includes((o.country ?? '').toUpperCase()));
  if (n === 0) return { text: U[0] };
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const thText = th ? (th === 1 ? 'mil' : `${pt3(th, U)} mil`) : '';
  if (!rest) return { text: thText };
  const restText = pt3(rest, U);
  if (!th) return { text: restText };
  // "mil e cinco", "mil e duzentos", but "mil duzentos e cinquenta".
  return { text: rest < 100 || rest % 100 === 0 ? `${thText} e ${restText}` : `${thText} ${restText}` };
}

// ---------------------------------------------------------------- French

const FR_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
/** Belgium and Luxembourg say septante (70) and nonante (90); quatre-vingts (80) stays. */
const FR_SEPTANTE = ['BE', 'LU'];

/** 0-99; `final`: nothing follows (quatre-vingts keeps its s). */
function fr2(r: number, sept: boolean, final: boolean): string {
  if (r < 17) return FR_U[r];
  if (r < 20) return `dix-${FR_U[r - 10]}`;
  const t = Math.floor(r / 10);
  const u = r % 10;
  if (!sept && (t === 7 || t === 9)) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt';
    const rest = r - (t === 7 ? 60 : 80);
    if (rest === 11 && t === 7) return 'soixante et onze';
    return `${base}-${fr2(rest, sept, true)}`;
  }
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'septante', 'quatre-vingt', 'nonante'][t];
  if (u === 0) return t === 8 && final ? 'quatre-vingts' : tens;
  if (u === 1 && t !== 8) return `${tens} et un`;
  return `${tens}-${FR_U[u]}`;
}

function fr3(n: number, sept: boolean, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? 'cent' : `${FR_U[h]} cent${!r && final ? 's' : ''}`);
  if (r) parts.push(fr2(r, sept, final));
  return parts.join(' ');
}

function fr(n: number, o: Opts): Parts {
  if (n === 0) return { text: FR_U[0] };
  const sept = FR_SEPTANTE.includes((o.country ?? '').toUpperCase());
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (th) parts.push(th === 1 ? 'mille' : `${fr3(th, sept, false)} mille`);
  if (rest) parts.push(fr3(rest, sept, true));
  return { text: parts.join(' ') };
}

// ---------------------------------------------------------------- German

const DE_U = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_T = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
/** Switzerland and Liechtenstein write ss for ß (dreissig). */
const DE_SS = ['CH', 'LI'];

/** 1-999; `final`: nothing follows, so a last 1 is "eins" (else "ein": eintausend). Unit before ten: fünfundvierzig. */
function de3(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = h ? `${h === 1 ? 'ein' : DE_U[h]}hundert` : '';
  if (r) {
    if (r === 1) s += final ? 'eins' : 'ein';
    else if (r < 20) s += DE_U[r];
    else {
      const u = r % 10;
      s += u ? `${u === 1 ? 'ein' : DE_U[u]}und${DE_T[Math.floor(r / 10)]}` : DE_T[Math.floor(r / 10)];
    }
  }
  return s;
}

function de(n: number, o: Opts): Parts {
  let s: string;
  if (n === 0) s = 'null';
  else if (n === 1 && o.noun) s = 'ein';
  else {
    const th = Math.floor(n / 1000);
    const rest = n % 1000;
    s = (th ? `${de3(th, false)}tausend` : '') + (rest ? de3(rest, true) : '');
  }
  if (DE_SS.includes((o.country ?? '').toUpperCase())) s = s.replace(/ß/g, 'ss');
  return { text: s };
}

// ---------------------------------------------------------------- Italian

const IT_U = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const IT_T = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

function it2(r: number): string {
  if (r < 20) return IT_U[r];
  const u = r % 10;
  const t = IT_T[Math.floor(r / 10)];
  if (!u) return t;
  // The tens drop their last vowel before uno / otto: ventuno, trentotto.
  return u === 1 || u === 8 ? t.slice(0, -1) + IT_U[u] : t + IT_U[u];
}

function it3(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return it2(r);
  const cento = `${h === 1 ? '' : IT_U[h]}cento`;
  if (!r) return cento;
  // centottanta (but centootto).
  return Math.floor(r / 10) === 8 ? cento.slice(0, -1) + it2(r) : cento + it2(r);
}

function it(n: number, o: Opts): Parts {
  if (n === 0) return { text: 'zero' };
  if (n === 1 && o.noun) return { text: 'un' };
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  let s = (th ? (th === 1 ? 'mille' : `${it3(th)}mila`) : '') + (rest ? it3(rest) : '');
  // A compound that ends in tre takes the accent: ventitré, milletré.
  if (s !== 'tre' && s.endsWith('tre')) s = s.slice(0, -3) + 'tré';
  return { text: s };
}

// ---------------------------------------------------------------- public

function parts(lang: PhraseLang, n: number, o: Opts): Parts {
  switch (lang) {
    case 'ja':
      return ja(n);
    case 'zh-Hans':
      return zhParts(zhWords(n, false, !!o.noun));
    case 'zh-Hant':
      return zhParts(zhWords(n, true, !!o.noun));
    case 'ko':
      return ko(n);
    case 'th':
      return th(n);
    case 'vi':
      return vi(n);
    case 'es':
      return es(n, o);
    case 'fr':
      return fr(n, o);
    case 'de':
      return de(n, o);
    case 'it':
      return it(n, o);
    case 'pt':
      return pt(n, o);
    case 'id':
      return idn(n);
  }
}

/** Languages written in Latin letters (no separate romanised line). */
export const LATIN_LANGS: readonly PhraseLang[] = ['vi', 'es', 'fr', 'de', 'it', 'pt', 'id'];

/**
 * A whole number 0-999,999 in words. Out of range, not whole or not a number -> null. `country` picks a regional
 * form where one exists (fr BE / LU septante, de CH / LI ss, pt PT / AO / MZ / CV spellings).
 */
export function spellNumber(lang: PhraseLang, n: number, opts: { country?: string | null } = {}): NumberReading | null {
  if (!isWholeInRange(n)) return null;
  const p = parts(lang, n, { country: opts.country ?? null, noun: null });
  return { lang, value: n, text: p.text, kana: p.kana ?? null, roman: p.roman ?? null, needsCheck: true };
}

// ---------------------------------------------------------------- prices at the till

export type PriceFormat = {
  /** Thousands separator. */
  group: string;
  /** Decimal mark. */
  decimal: string;
  symbol: string;
  before: boolean;
  /** A no-break space between the symbol and the number. */
  space: boolean;
  /** Numbers under 10,000 are written without grouping (Spain, Portugal: 1250 €). */
  minGroup2?: boolean;
};

const NBSP = ' ';
const NNBSP = ' ';
const f = (group: string, decimal: string, symbol: string, before: boolean, space: boolean, minGroup2 = false): PriceFormat => ({ group, decimal, symbol, before, space, minGroup2 });

/** How prices are written at the till, by country (the countries of the 12 phrase languages). */
export const PRICE_FORMATS: Readonly<Record<string, PriceFormat>> = {
  JP: f(',', '.', '円', false, false),
  CN: f(',', '.', '¥', true, false),
  TW: f(',', '.', 'NT$', true, false),
  HK: f(',', '.', 'HK$', true, false),
  MO: f(',', '.', 'MOP$', true, false),
  KR: f(',', '.', '원', false, false),
  TH: f(',', '.', '฿', true, false),
  VN: f('.', ',', '₫', false, true),
  ES: f('.', ',', '€', false, true, true),
  MX: f(',', '.', '$', true, false),
  AR: f('.', ',', '$', true, true),
  BO: f('.', ',', 'Bs', true, true),
  CL: f('.', ',', '$', true, false),
  CO: f('.', ',', '$', true, true),
  CR: f(NBSP, ',', '₡', true, false),
  CU: f('.', ',', '$', true, false),
  DO: f(',', '.', 'RD$', true, false),
  EC: f('.', ',', '$', true, false),
  GT: f(',', '.', 'Q', true, false),
  HN: f(',', '.', 'L', true, true),
  NI: f(',', '.', 'C$', true, true),
  PA: f(',', '.', 'B/.', true, false),
  PE: f(',', '.', 'S/', true, true),
  PR: f(',', '.', '$', true, false),
  PY: f('.', ',', '₲', true, true),
  SV: f(',', '.', '$', true, false),
  UY: f('.', ',', '$', true, true),
  VE: f('.', ',', 'Bs.', true, true),
  FR: f(NNBSP, ',', '€', false, true),
  BE: f(NNBSP, ',', '€', false, true),
  LU: f('.', ',', '€', false, true),
  MC: f(NNBSP, ',', '€', false, true),
  DE: f('.', ',', '€', false, true),
  AT: f('.', ',', '€', true, true),
  CH: f('’', '.', 'CHF', true, true),
  LI: f('’', '.', 'CHF', true, true),
  IT: f('.', ',', '€', false, true),
  SM: f('.', ',', '€', false, true),
  VA: f('.', ',', '€', false, true),
  BR: f('.', ',', 'R$', true, true),
  PT: f(NBSP, ',', '€', false, true, true),
  AO: f(NBSP, ',', 'Kz', false, true),
  MZ: f(NBSP, ',', 'MTn', false, true),
  CV: f(NBSP, ',', 'CVE', false, true),
  ID: f('.', ',', 'Rp', true, true),
};

/** Currencies whose cents never show up at the till (prices are whole), even though ISO gives them two decimals. */
const WHOLE_AT_TILL = ['IDR', 'TWD', 'COP'];

/** Decimals a price has at the till in this currency. */
export const tillDigits = (currency: string): number => (WHOLE_AT_TILL.includes(currency) ? 0 : currencyDigits(currency));

/** The till currency of a country (Panama: the balboa, as the price tags say). Null when unknown. */
export const tillCurrency = (country: string): string | null => currencyForCountry(country)?.code ?? null;

/** Countries the till card knows (local format and language). */
export const TILL_COUNTRIES = Object.keys(PRICE_FORMATS);

const groupDigits = (digits: string, sep: string, min2: boolean): string => {
  if (digits.length <= 3 || (min2 && digits.length <= 4)) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
};

/**
 * An amount in minor units (cents; whole units for 0-decimal currencies) written the way a price tag in the country
 * shows it: "1,250円", "12,50 €", "R$ 1.250,50", "CHF 1’250.50". Unknown country: "CODE 1,250.50".
 */
export function formatPrice(minor: number, currency: string, country: string): string {
  const fmt = PRICE_FORMATS[country.toUpperCase()] ?? f(',', '.', currency, true, true);
  const d = tillDigits(currency);
  const iso = currencyDigits(currency);
  // Minor units are always in the ISO decimals; a whole-at-till currency rounds to the unit.
  const units = Math.round(Math.abs(minor)) / 10 ** iso;
  const fixed = units.toFixed(d);
  const [int, frac] = fixed.split('.');
  const num = groupDigits(int, fmt.group, !!fmt.minGroup2) + (frac ? fmt.decimal + frac : '');
  const sp = fmt.space ? NBSP : '';
  return fmt.before ? `${fmt.symbol}${sp}${num}` : `${num}${sp}${fmt.symbol}`;
}

type Word = { one: string; many: string; g: 'm' | 'f' };
const w = (one: string, many: string = one, g: 'm' | 'f' = 'm'): Word => ({ one, many, g });

/** Currency words for the Latin-script languages, by currency. */
const CURRENCY_WORDS: Partial<Record<PhraseLang, Record<string, Word>>> = {
  es: {
    EUR: w('euro', 'euros'),
    USD: w('dólar', 'dólares'),
    MXN: w('peso', 'pesos'),
    ARS: w('peso', 'pesos'),
    CLP: w('peso', 'pesos'),
    COP: w('peso', 'pesos'),
    CUP: w('peso', 'pesos'),
    DOP: w('peso', 'pesos'),
    UYU: w('peso', 'pesos'),
    BOB: w('boliviano', 'bolivianos'),
    CRC: w('colón', 'colones'),
    GTQ: w('quetzal', 'quetzales'),
    HNL: w('lempira', 'lempiras', 'f'),
    NIO: w('córdoba', 'córdobas'),
    PAB: w('balboa', 'balboas'),
    PEN: w('sol', 'soles'),
    PYG: w('guaraní', 'guaraníes'),
    VES: w('bolívar', 'bolívares'),
  },
  fr: { EUR: w('euro', 'euros'), CHF: w('franc', 'francs') },
  de: { EUR: w('Euro'), CHF: w('Franken') },
  it: { EUR: w('euro'), CHF: w('franco', 'franchi') },
  pt: { EUR: w('euro', 'euros'), BRL: w('real', 'reais'), AOA: w('kwanza', 'kwanzas'), MZN: w('metical', 'meticais'), CVE: w('escudo', 'escudos'), USD: w('dólar', 'dólares') },
  vi: { VND: w('đồng'), USD: w('đô la') },
  id: { IDR: w('rupiah') },
};

/** Cent words, said only for an amount under one unit ("cincuenta céntimos"). */
const CENT_WORDS: Partial<Record<PhraseLang, Record<string, Word> & { _?: Word }>> = {
  es: { _: w('centavo', 'centavos'), EUR: w('céntimo', 'céntimos'), PEN: w('céntimo', 'céntimos') },
  fr: { _: w('centime', 'centimes') },
  de: { _: w('Cent'), CHF: w('Rappen') },
  it: { _: w('centesimo', 'centesimi') },
  pt: { _: w('centavo', 'centavos'), EUR: w('cêntimo', 'cêntimos') },
};

/** How the major and minor parts join: "doce euros con cincuenta", "dodici euro e cinquanta", "zwölf Euro fünfzig". */
const CENT_JOIN: Partial<Record<PhraseLang, string>> = { es: ' con ', it: ' e ', pt: ' e ', fr: ' ', de: ' ', vi: ' ', id: ' ' };

const plural = (lang: PhraseLang, n: number, word: Word) => (lang === 'fr' ? (n < 2 ? word.one : word.many) : n === 1 ? word.one : word.many);

/** CJK / Thai currency words: [text, kana or null, roman]. */
const ASIAN_UNIT: Record<string, Partial<Record<PhraseLang, [string, string | null, string]>>> = {
  JPY: { ja: ['円', 'えん', 'en'] },
  CNY: { 'zh-Hans': ['元', null, 'yuán'], 'zh-Hant': ['元', null, 'yuán'] },
  TWD: { 'zh-Hans': ['元', null, 'yuán'], 'zh-Hant': ['元', null, 'yuán'] },
  HKD: { 'zh-Hans': ['元', null, 'yuán'], 'zh-Hant': ['元', null, 'yuán'] },
  MOP: { 'zh-Hans': ['元', null, 'yuán'], 'zh-Hant': ['元', null, 'yuán'] },
  KRW: { ko: ['원', null, 'won'] },
  THB: { th: ['บาท', null, 'baht'] },
};

/**
 * An amount read out in a language with its currency word: "千二百五十円" (sen nihyaku gojū en), "十二元五角",
 * "만 이천 원", "สิบสองบาทห้าสิบสตางค์", "doce euros con cincuenta", "douze euros cinquante". The whole part must be
 * 0-999,999. A currency the language has no word for is read as the number, then the code ("doce USD"). Null when out
 * of range.
 */
export function speakPrice(lang: PhraseLang, minor: number, currency: string, country: string | null = null): NumberReading | null {
  const iso = currencyDigits(currency);
  const d = tillDigits(currency);
  const abs = Math.round(Math.abs(minor));
  const scaled = d === iso ? abs : Math.round(abs / 10 ** (iso - d));
  const major = Math.floor(scaled / 10 ** d);
  const cents = d ? scaled % 10 ** d : 0;
  if (!isWholeInRange(major)) return null;
  const opts = { country };
  const asian = ASIAN_UNIT[currency]?.[lang];
  let text: string;
  let kana: string | null = null;
  let roman: string | null = null;
  if (asian && (lang === 'zh-Hans' || lang === 'zh-Hant')) {
    const trad = lang === 'zh-Hant';
    const words: ZhWord[] = [];
    if (major || !cents) {
      const m = zhWords(major, trad, true);
      const last = m[m.length - 1];
      m[m.length - 1] = { t: last.t + asian[0], p: [...last.p, asian[2]] };
      words.push(...m);
    }
    const jiao = Math.floor(cents / 10);
    const fen = cents % 10;
    if (jiao) words.push({ t: (jiao === 2 ? (trad ? '兩' : '两') : ZH_D[jiao]) + '角', p: [jiao === 2 ? 'liǎng' : ZH_P[jiao], 'jiǎo'] });
    if (fen) {
      if (!jiao && major) words.push({ t: '零', p: ['líng'] });
      words.push({ t: (fen === 2 ? (trad ? '兩' : '两') : ZH_D[fen]) + '分', p: [fen === 2 ? 'liǎng' : ZH_P[fen], 'fēn'] });
    }
    const p = zhParts(words);
    // Each pinyin word is already joined; the measure word reads as its own word.
    text = p.text;
    roman = words.map((x) => (x.p.length > 1 && ['yuán', 'jiǎo', 'fēn'].includes(x.p[x.p.length - 1]) ? `${pinyinWord(x.p.slice(0, -1))} ${x.p[x.p.length - 1]}` : pinyinWord(x.p))).join(' ');
  } else if (asian) {
    const p = parts(lang, major, { country, noun: 'm' });
    if (lang === 'ko') {
      text = `${p.text} ${asian[0]}`;
      roman = `${p.roman} ${asian[2]}`;
    } else {
      text = p.text + asian[0];
      kana = p.kana != null ? p.kana + (asian[1] ?? '') : asian[1];
      if (lang === 'ja' && major === 0) kana = 'ぜろえん';
      roman = `${p.roman} ${asian[2]}`;
      if (lang === 'th' && cents) {
        const c = th(cents);
        text += `${c.text}สตางค์`;
        roman += ` ${c.roman} satang`;
      }
    }
  } else {
    const word = CURRENCY_WORDS[lang]?.[currency];
    const latin = LATIN_LANGS.includes(lang);
    if (major === 0 && cents && word) {
      const cw = CENT_WORDS[lang]?.[currency] ?? CENT_WORDS[lang]?._;
      if (cw) {
        const c = parts(lang, cents, { country, noun: cw.g });
        return { lang, value: major, text: `${c.text} ${plural(lang, cents, cw)}`, kana: null, roman: null, needsCheck: true };
      }
    }
    const p = parts(lang, major, { country, noun: word ? word.g : null });
    text = `${p.text} ${word ? plural(lang, major, word) : currency}`;
    roman = latin ? null : p.roman ?? null;
    kana = p.kana ?? null;
    if (cents) {
      const c = parts(lang, cents, { country, noun: null });
      text += `${CENT_JOIN[lang] ?? ' '}${c.text}`;
      if (roman && c.roman) roman += ` ${c.roman}`;
    }
  }
  return { lang, value: major, text, kana, roman, needsCheck: true };
}

export type TillCard = {
  country: string;
  currency: string;
  lang: PhraseLang;
  /** The price as the tag shows it. */
  written: string;
  /** The price read out. */
  spoken: NumberReading;
};

/** The till card for an amount (minor units) in a country: its currency, the local writing and the reading. */
export function tillCard(phrases: PhraseTable, country: string, minor: number): TillCard | null {
  const c = country.trim().toUpperCase();
  const lang = languageForCountry(phrases, c);
  const currency = tillCurrency(c);
  if (!lang || !currency || !Number.isFinite(minor) || minor < 0) return null;
  const spoken = speakPrice(lang, minor, currency, c);
  if (!spoken) return null;
  return { country: c, currency, lang, written: formatPrice(minor, currency, c), spoken };
}

/** Countries for the till picker: the trip's (that the card knows) first, in trip order, then the rest. */
export function tillCountryOrder(phrases: PhraseTable, tripCountries: readonly (string | null | undefined)[]): { countries: string[]; fromTrip: string[] } {
  const known = TILL_COUNTRIES.filter((c) => languageForCountry(phrases, c) && tillCurrency(c));
  const fromTrip: string[] = [];
  for (const raw of tripCountries) {
    const c = (raw ?? '').trim().toUpperCase();
    if (known.includes(c) && !fromTrip.includes(c)) fromTrip.push(c);
  }
  return { countries: [...fromTrip, ...known.filter((c) => !fromTrip.includes(c))], fromTrip };
}

/**
 * Reads a typed amount for the till card into minor units of the currency: digits with an optional decimal mark
 * ("." or ",") and up to the till's decimals; spaces and group marks are dropped. Whole part up to 999,999. Null
 * when it doesn't read.
 */
export function parseTillAmount(text: string, currency: string): number | null {
  const s = text.trim().replace(/[\s  ’']/g, '');
  if (!s) return null;
  const d = tillDigits(currency);
  const iso = currencyDigits(currency);
  const m = /^(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d+))?$/.exec(s);
  if (!m) return null;
  let intText = m[1];
  let frac = m[2] ?? '';
  // "12,50" / "12.5": a single mark followed by 1-2 digits is the decimal mark, not grouping.
  if (!m[2] && /^\d+[.,]\d{1,2}$/.test(s)) {
    const at = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    intText = s.slice(0, at);
    frac = s.slice(at + 1);
  }
  intText = intText.replace(/[.,]/g, '');
  if (frac.length > d) return null;
  const whole = Number(intText);
  if (!isWholeInRange(whole)) return null;
  const minorAtTill = whole * 10 ** d + Number(frac.padEnd(d, '0') || '0');
  return minorAtTill * 10 ** (iso - d);
}

// ---------------------------------------------------------------- quiz

export const QUIZ_LEVELS = ['small', 'prices', 'big'] as const;
export type QuizLevel = (typeof QUIZ_LEVELS)[number];
export const isQuizLevel = (v: unknown): v is QuizLevel => typeof v === 'string' && (QUIZ_LEVELS as readonly string[]).includes(v);

export const QUIZ_LENGTH = 10;
/** Time for one question. */
export const QUESTION_MS = 15_000;

export type QuizQuestion = {
  lang: PhraseLang;
  answer: number;
  reading: NumberReading;
  /** Four numbers, the answer among them, in a seeded order. */
  choices: number[];
};

const RANGES: Record<QuizLevel, [number, number]> = { small: [0, 99], prices: [100, 9_999], big: [10_000, MAX_NUMBER] };

/** A number for a level: prices and big numbers look like price tags (mostly round). */
function pickValue(level: QuizLevel, r: () => number): number {
  const [lo, hi] = RANGES[level];
  const raw = lo + Math.floor(r() * (hi - lo + 1));
  if (level === 'small') return raw;
  const roll = r();
  const step = level === 'prices' ? (roll < 0.4 ? 10 : roll < 0.7 ? 50 : roll < 0.85 ? 100 : 1) : roll < 0.4 ? 1000 : roll < 0.7 ? 100 : roll < 0.85 ? 500 : 1;
  return Math.min(hi, Math.max(lo, Math.round(raw / step) * step));
}

/** Plausible wrong answers: digits swapped, one digit off, tens and teens mixed up (17 / 70), a place off. */
function nearMisses(n: number, level: QuizLevel): number[] {
  const [lo, hi] = RANGES[level];
  const s = String(n);
  const out: number[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.split('');
    [a[i], a[i + 1]] = [a[i + 1], a[i]];
    out.push(Number(a.join('')));
  }
  for (let i = 0; i < s.length; i++) {
    const place = 10 ** (s.length - 1 - i);
    out.push(n + place, n - place);
  }
  if (n >= 10 && n <= 19) out.push((n - 10) * 10);
  if (n % 10 === 0 && n >= 30 && n <= 90) out.push(10 + n / 10, n + 10, n - 10);
  out.push(n * 10, Math.floor(n / 10), n + 10, n - 10, n + 100, n - 100, n + 1000, n - 1000);
  return out.filter((x) => Number.isInteger(x) && x >= lo && x <= hi && x !== n);
}

/** Four choices for an answer: three near misses picked by the seed, then shuffled. Always 4 distinct numbers. */
export function quizChoices(answer: number, level: QuizLevel, seed: number): number[] {
  const r = rng(seed);
  const pool = [...new Set(nearMisses(answer, level))];
  const picked = shuffle(pool, seed).slice(0, 3);
  const [lo, hi] = RANGES[level];
  let guard = 0;
  while (picked.length < 3 && guard++ < 1000) {
    const x = lo + Math.floor(r() * (hi - lo + 1));
    if (x !== answer && !picked.includes(x)) picked.push(x);
  }
  return shuffle([answer, ...picked], seedFrom(`order:${seed}`));
}

/**
 * A quiz: `count` questions, the languages taken in turn from `langs` (pass the trip's languages first), numbers for
 * the level. The same seed, languages and level always give the same quiz.
 */
export function buildQuiz(seed: number, langs: readonly PhraseLang[], level: QuizLevel, count: number = QUIZ_LENGTH, country: string | null = null): QuizQuestion[] {
  const use = langs.length ? [...langs] : [PHRASE_LANGS[0]];
  const r = rng(seedFrom(`numbers:${level}:${seed}`));
  const out: QuizQuestion[] = [];
  const seen = new Set<number>();
  for (let i = 0; out.length < count && i < count * 20; i++) {
    const value = pickValue(level, r);
    if (seen.has(value) && i < count * 10) continue;
    seen.add(value);
    const lang = use[out.length % use.length];
    const reading = spellNumber(lang, value, { country });
    if (!reading) continue;
    out.push({ lang, answer: value, reading, choices: quizChoices(value, level, seedFrom(`${seed}:${out.length}:${value}`)) });
  }
  return out;
}

/** Points for a right answer: 10, plus up to 5 for speed. A wrong answer or no answer in time scores 0. */
export function pointsFor(right: boolean, msLeft: number): number {
  if (!right) return 0;
  const left = Math.max(0, Math.min(QUESTION_MS, msLeft));
  return 10 + Math.round((left / QUESTION_MS) * 5);
}

// ---------------------------------------------------------------- scores on this phone

/** Persisted key (src/state/persisted.ts): best scores, on this phone only (never on a trip or in a trip file). */
export const NUMBERS_KEY = 'satchel.numbers.v1';

export type NumbersState = {
  /** Best total by "<lang or mix>:<level>". */
  best: Record<string, number>;
  /** Quizzes finished. */
  played: number;
};

export const EMPTY_NUMBERS: NumbersState = { best: {}, played: 0 };
const MAX_SCORE = QUIZ_LENGTH * 15;

/** Stored value -> clean state (junk dropped, scores clamped). */
export function cleanNumbers(raw: unknown): NumbersState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { best: {}, played: 0 };
  const o = raw as Record<string, unknown>;
  const best: Record<string, number> = {};
  if (typeof o.best === 'object' && o.best !== null && !Array.isArray(o.best)) {
    for (const [k, v] of Object.entries(o.best as Record<string, unknown>)) {
      const [who, level] = k.split(':');
      if ((who === 'mix' || (PHRASE_LANGS as readonly string[]).includes(who)) && isQuizLevel(level) && typeof v === 'number' && Number.isFinite(v) && v > 0) {
        best[k] = Math.min(MAX_SCORE, Math.round(v));
      }
    }
  }
  const played = typeof o.played === 'number' && Number.isFinite(o.played) && o.played > 0 ? Math.min(1e6, Math.floor(o.played)) : 0;
  return { best, played };
}

export const scoreKey = (who: PhraseLang | 'mix', level: QuizLevel) => `${who}:${level}`;

/** The state after a finished quiz: played + 1 and the best kept. Also says whether this was a new best. */
export function recordScore(state: NumbersState, key: string, score: number): { state: NumbersState; newBest: boolean } {
  const s = cleanNumbers(state);
  const old = s.best[key] ?? 0;
  const v = Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
  const newBest = v > old;
  return { state: { best: newBest ? { ...s.best, [key]: v } : s.best, played: s.played + 1 }, newBest };
}
