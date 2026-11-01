import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  buildQuiz,
  cleanNumbers,
  formatPrice,
  groupedDigits,
  parseWhole,
  MAX_NUMBER,
  parseTillAmount,
  pointsFor,
  QUESTION_MS,
  QUIZ_LEVELS,
  QUIZ_LENGTH,
  quizChoices,
  recordScore,
  scoreKey,
  speakPrice,
  spellNumber,
  tillCard,
  tillCountryOrder,
  TILL_COUNTRIES,
  tillDigits,
} from './numbers.ts';
import { PHRASE_LANGS, type PhraseLang, type PhraseTable } from './phrases.ts';

const TABLE = JSON.parse(readFileSync(new URL('../content/phrases.json', import.meta.url), 'utf8')) as PhraseTable;
const NBSP = ' ';
const NNBSP = ' ';

// Known values per language: [n, text, roman?]. The acceptance set is 0, 10, 11, 20, 70, 80, 99, 100, 1,000, 10,000,
// 12,345 and 999,999; a few rule-specific values follow.
const KNOWN: Record<PhraseLang, [number, string, string?][]> = {
  ja: [
    [0, 'ゼロ', 'zero'],
    [10, '十', 'jū'],
    [11, '十一', 'jūichi'],
    [20, '二十', 'nijū'],
    [70, '七十', 'nanajū'],
    [80, '八十', 'hachijū'],
    [99, '九十九', 'kyūjūkyū'],
    [100, '百', 'hyaku'],
    [1000, '千', 'sen'],
    [10000, '一万', 'ichiman'],
    [12345, '一万二千三百四十五', 'ichiman nisen sanbyaku yonjūgo'],
    [999999, '九十九万九千九百九十九', 'kyūjūkyūman kyūsen kyūhyaku kyūjūkyū'],
    [300, '三百', 'sanbyaku'],
    [600, '六百', 'roppyaku'],
    [800, '八百', 'happyaku'],
    [3000, '三千', 'sanzen'],
    [8000, '八千', 'hassen'],
    [100000, '十万', 'jūman'],
  ],
  'zh-Hans': [
    [0, '零', 'líng'],
    [10, '十', 'shí'],
    [11, '十一', 'shíyī'],
    [20, '二十', 'èrshí'],
    [70, '七十', 'qīshí'],
    [80, '八十', 'bāshí'],
    [99, '九十九', 'jiǔshíjiǔ'],
    [100, '一百', 'yībǎi'],
    [1000, '一千', 'yīqiān'],
    [10000, '一万', 'yīwàn'],
    [12345, '一万两千三百四十五', 'yīwàn liǎngqiān sānbǎi sìshíwǔ'],
    [999999, '九十九万九千九百九十九', 'jiǔshíjiǔwàn jiǔqiān jiǔbǎi jiǔshíjiǔ'],
    [12, '十二', "shí'èr"],
    [2, '二', 'èr'],
    [200, '两百', 'liǎngbǎi'],
    [20000, '两万', 'liǎngwàn'],
    [1005, '一千零五', 'yīqiān líng wǔ'],
    [10500, '一万零五百', 'yīwàn líng wǔbǎi'],
    [110, '一百一十', 'yībǎi yīshí'],
    [100005, '十万零五', 'shíwàn líng wǔ'],
    [101000, '十万一千', 'shíwàn yīqiān'],
  ],
  'zh-Hant': [
    [0, '零', 'líng'],
    [10, '十', 'shí'],
    [11, '十一', 'shíyī'],
    [20, '二十', 'èrshí'],
    [70, '七十', 'qīshí'],
    [80, '八十', 'bāshí'],
    [99, '九十九', 'jiǔshíjiǔ'],
    [100, '一百', 'yībǎi'],
    [1000, '一千', 'yīqiān'],
    [10000, '一萬', 'yīwàn'],
    [12345, '一萬兩千三百四十五', 'yīwàn liǎngqiān sānbǎi sìshíwǔ'],
    [999999, '九十九萬九千九百九十九', 'jiǔshíjiǔwàn jiǔqiān jiǔbǎi jiǔshíjiǔ'],
    [20000, '兩萬', 'liǎngwàn'],
  ],
  ko: [
    [0, '영', 'yeong'],
    [10, '십', 'sip'],
    [11, '십일', 'sibil'],
    [20, '이십', 'isip'],
    [70, '칠십', 'chilsip'],
    [80, '팔십', 'palsip'],
    [99, '구십구', 'gusipgu'],
    [100, '백', 'baek'],
    [1000, '천', 'cheon'],
    [10000, '만', 'man'],
    [12345, '만 이천삼백사십오', 'man icheon sambaek sasibo'],
    [999999, '구십구만 구천구백구십구', 'gusipguman gucheon gubaek gusipgu'],
    [16, '십육', 'simnyuk'],
    [106, '백육', 'baengnyuk'],
    [100000, '십만', 'simman'],
    [60000, '육만', 'yungman'],
    [15000, '만 오천', 'man ocheon'],
  ],
  th: [
    [0, 'ศูนย์', 'sun'],
    [10, 'สิบ', 'sip'],
    [11, 'สิบเอ็ด', 'sip et'],
    [20, 'ยี่สิบ', 'yi sip'],
    [70, 'เจ็ดสิบ', 'chet sip'],
    [80, 'แปดสิบ', 'paet sip'],
    [99, 'เก้าสิบเก้า', 'kao sip kao'],
    [100, 'หนึ่งร้อย', 'nueng roi'],
    [1000, 'หนึ่งพัน', 'nueng phan'],
    [10000, 'หนึ่งหมื่น', 'nueng muen'],
    [12345, 'หนึ่งหมื่นสองพันสามร้อยสี่สิบห้า', 'nueng muen song phan sam roi si sip ha'],
    [999999, 'เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้า', 'kao saen kao muen kao phan kao roi kao sip kao'],
    [21, 'ยี่สิบเอ็ด', 'yi sip et'],
    [1, 'หนึ่ง', 'nueng'],
    [100000, 'หนึ่งแสน', 'nueng saen'],
  ],
  vi: [
    [0, 'không'],
    [10, 'mười'],
    [11, 'mười một'],
    [20, 'hai mươi'],
    [70, 'bảy mươi'],
    [80, 'tám mươi'],
    [99, 'chín mươi chín'],
    [100, 'một trăm'],
    [1000, 'một nghìn'],
    [10000, 'mười nghìn'],
    [12345, 'mười hai nghìn ba trăm bốn mươi lăm'],
    [999999, 'chín trăm chín mươi chín nghìn chín trăm chín mươi chín'],
    [15, 'mười lăm'],
    [21, 'hai mươi mốt'],
    [105, 'một trăm lẻ năm'],
    [1005, 'một nghìn không trăm lẻ năm'],
  ],
  es: [
    [0, 'cero'],
    [10, 'diez'],
    [11, 'once'],
    [20, 'veinte'],
    [70, 'setenta'],
    [80, 'ochenta'],
    [99, 'noventa y nueve'],
    [100, 'cien'],
    [1000, 'mil'],
    [10000, 'diez mil'],
    [12345, 'doce mil trescientos cuarenta y cinco'],
    [999999, 'novecientos noventa y nueve mil novecientos noventa y nueve'],
    [21, 'veintiuno'],
    [101, 'ciento uno'],
    [21000, 'veintiún mil'],
    [100000, 'cien mil'],
    [500, 'quinientos'],
  ],
  fr: [
    [0, 'zéro'],
    [10, 'dix'],
    [11, 'onze'],
    [20, 'vingt'],
    [70, 'soixante-dix'],
    [80, 'quatre-vingts'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [1000, 'mille'],
    [10000, 'dix mille'],
    [12345, 'douze mille trois cent quarante-cinq'],
    [999999, 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf'],
    [21, 'vingt et un'],
    [71, 'soixante et onze'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [80000, 'quatre-vingt mille'],
    [200000, 'deux cent mille'],
  ],
  de: [
    [0, 'null'],
    [10, 'zehn'],
    [11, 'elf'],
    [20, 'zwanzig'],
    [70, 'siebzig'],
    [80, 'achtzig'],
    [99, 'neunundneunzig'],
    [100, 'einhundert'],
    [1000, 'eintausend'],
    [10000, 'zehntausend'],
    [12345, 'zwölftausenddreihundertfünfundvierzig'],
    [999999, 'neunhundertneunundneunzigtausendneunhundertneunundneunzig'],
    [1, 'eins'],
    [21, 'einundzwanzig'],
    [30, 'dreißig'],
    [101, 'einhunderteins'],
    [1001, 'eintausendeins'],
    [21000, 'einundzwanzigtausend'],
  ],
  it: [
    [0, 'zero'],
    [10, 'dieci'],
    [11, 'undici'],
    [20, 'venti'],
    [70, 'settanta'],
    [80, 'ottanta'],
    [99, 'novantanove'],
    [100, 'cento'],
    [1000, 'mille'],
    [10000, 'diecimila'],
    [12345, 'dodicimilatrecentoquarantacinque'],
    [999999, 'novecentonovantanovemilanovecentonovantanove'],
    [21, 'ventuno'],
    [28, 'ventotto'],
    [23, 'ventitré'],
    [3, 'tre'],
    [180, 'centottanta'],
    [1003, 'milletré'],
    [21000, 'ventunomila'],
  ],
  pt: [
    [0, 'zero'],
    [10, 'dez'],
    [11, 'onze'],
    [20, 'vinte'],
    [70, 'setenta'],
    [80, 'oitenta'],
    [99, 'noventa e nove'],
    [100, 'cem'],
    [1000, 'mil'],
    [10000, 'dez mil'],
    [12345, 'doze mil trezentos e quarenta e cinco'],
    [999999, 'novecentos e noventa e nove mil novecentos e noventa e nove'],
    [16, 'dezesseis'],
    [101, 'cento e um'],
    [1005, 'mil e cinco'],
    [1200, 'mil e duzentos'],
    [1250, 'mil duzentos e cinquenta'],
    [100000, 'cem mil'],
  ],
  id: [
    [0, 'nol'],
    [10, 'sepuluh'],
    [11, 'sebelas'],
    [20, 'dua puluh'],
    [70, 'tujuh puluh'],
    [80, 'delapan puluh'],
    [99, 'sembilan puluh sembilan'],
    [100, 'seratus'],
    [1000, 'seribu'],
    [10000, 'sepuluh ribu'],
    [12345, 'dua belas ribu tiga ratus empat puluh lima'],
    [999999, 'sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan'],
    [12, 'dua belas'],
    [100000, 'seratus ribu'],
  ],
};

const REQUIRED = [0, 10, 11, 20, 70, 80, 99, 100, 1000, 10000, 12345, 999999];

test('every language has the required known values', () => {
  for (const lang of PHRASE_LANGS) {
    const have = KNOWN[lang].map((k) => k[0]);
    for (const n of REQUIRED) assert.ok(have.includes(n), `${lang} misses ${n}`);
  }
});

for (const lang of PHRASE_LANGS) {
  test(`known values: ${lang}`, () => {
    for (const [n, text, roman] of KNOWN[lang]) {
      const r = spellNumber(lang, n);
      assert.ok(r, `${lang} ${n}`);
      assert.equal(r.text, text, `${lang} ${n} text`);
      if (roman !== undefined) assert.equal(r.roman, roman, `${lang} ${n} roman`);
      assert.equal(r.needsCheck, true);
    }
  });
}

test('Japanese carries a kana reading', () => {
  assert.equal(spellNumber('ja', 12345)?.kana, 'いちまんにせんさんびゃくよんじゅうご');
  assert.equal(spellNumber('ja', 999999)?.kana, 'きゅうじゅうきゅうまんきゅうせんきゅうひゃくきゅうじゅうきゅう');
  assert.equal(spellNumber('ja', 600)?.kana, 'ろっぴゃく');
});

test('Latin-script languages have no romanised line; the others always do', () => {
  for (const lang of PHRASE_LANGS) {
    const r = spellNumber(lang, 4321)!;
    if (['vi', 'es', 'fr', 'de', 'it', 'pt', 'id'].includes(lang)) assert.equal(r.roman, null, lang);
    else assert.ok(r.roman && /^[a-zāēīōūǎǐǒǔàèìòùáéíóúü' ]+$/.test(r.roman), `${lang}: ${r.roman}`);
  }
});

test('regional forms by country', () => {
  assert.equal(spellNumber('fr', 70, { country: 'BE' })?.text, 'septante');
  assert.equal(spellNumber('fr', 71, { country: 'BE' })?.text, 'septante et un');
  assert.equal(spellNumber('fr', 90, { country: 'LU' })?.text, 'nonante');
  assert.equal(spellNumber('fr', 97, { country: 'BE' })?.text, 'nonante-sept');
  assert.equal(spellNumber('fr', 80, { country: 'BE' })?.text, 'quatre-vingts');
  assert.equal(spellNumber('fr', 70, { country: 'FR' })?.text, 'soixante-dix');
  assert.equal(spellNumber('de', 30, { country: 'CH' })?.text, 'dreissig');
  assert.equal(spellNumber('de', 30, { country: 'AT' })?.text, 'dreißig');
  assert.equal(spellNumber('pt', 16, { country: 'PT' })?.text, 'dezasseis');
  assert.equal(spellNumber('pt', 19, { country: 'PT' })?.text, 'dezanove');
  assert.equal(spellNumber('pt', 19, { country: 'BR' })?.text, 'dezenove');
});

test('every number in range spells in every language, never empty or with doubled spaces', () => {
  for (const lang of PHRASE_LANGS) {
    for (let n = 0; n <= MAX_NUMBER; n += n < 2000 ? 1 : 997) {
      const r = spellNumber(lang, n)!;
      assert.ok(r.text && !/\s{2}|^\s|\s$/.test(r.text), `${lang} ${n}: "${r.text}"`);
      if (r.roman !== null) assert.ok(!/\s{2}|^\s|\s$/.test(r.roman), `${lang} ${n} roman`);
      assert.ok(!/undefined/.test(r.text + (r.roman ?? '')), `${lang} ${n}`);
    }
  }
});

test('different numbers read differently', () => {
  for (const lang of PHRASE_LANGS) {
    const seen = new Map<string, number>();
    for (let n = 0; n <= 3000; n++) {
      const t = spellNumber(lang, n)!.text;
      assert.ok(!seen.has(t), `${lang}: ${n} and ${seen.get(t)} both read "${t}"`);
      seen.set(t, n);
    }
  }
});

test('out of range or not whole -> null', () => {
  for (const bad of [-1, 1_000_000, 1.5, Number.NaN, Infinity]) assert.equal(spellNumber('ja', bad), null);
  assert.equal(spellNumber('es', MAX_NUMBER)?.value, MAX_NUMBER);
});

test('prices at the till: written the local way', () => {
  assert.equal(formatPrice(1250, 'JPY', 'JP'), '1,250円');
  assert.equal(formatPrice(12500, 'KRW', 'KR'), '12,500원');
  assert.equal(formatPrice(125050, 'CNY', 'CN'), '¥1,250.50');
  assert.equal(formatPrice(125000, 'TWD', 'TW'), 'NT$1,250');
  assert.equal(formatPrice(125050, 'HKD', 'HK'), 'HK$1,250.50');
  assert.equal(formatPrice(125050, 'THB', 'TH'), '฿1,250.50');
  assert.equal(formatPrice(12345, 'VND', 'VN'), `12.345${NBSP}₫`);
  assert.equal(formatPrice(125050, 'EUR', 'ES'), `1250,50${NBSP}€`);
  assert.equal(formatPrice(1250050, 'EUR', 'ES'), `12.500,50${NBSP}€`);
  assert.equal(formatPrice(125050, 'MXN', 'MX'), '$1,250.50');
  assert.equal(formatPrice(125050, 'ARS', 'AR'), `$${NBSP}1.250,50`);
  assert.equal(formatPrice(1250, 'CLP', 'CL'), '$1.250');
  assert.equal(formatPrice(125050, 'EUR', 'FR'), `1${NNBSP}250,50${NBSP}€`);
  assert.equal(formatPrice(125050, 'EUR', 'DE'), `1.250,50${NBSP}€`);
  assert.equal(formatPrice(125050, 'EUR', 'AT'), `€${NBSP}1.250,50`);
  assert.equal(formatPrice(125050, 'CHF', 'CH'), `CHF${NBSP}1’250.50`);
  assert.equal(formatPrice(125050, 'EUR', 'IT'), `1.250,50${NBSP}€`);
  assert.equal(formatPrice(125050, 'BRL', 'BR'), `R$${NBSP}1.250,50`);
  assert.equal(formatPrice(125050, 'EUR', 'PT'), `1250,50${NBSP}€`);
  assert.equal(formatPrice(1234500, 'IDR', 'ID'), `Rp${NBSP}12.345`);
  assert.equal(formatPrice(5, 'EUR', 'DE'), `0,05${NBSP}€`);
  assert.equal(formatPrice(125050, 'GBP', 'GB'), `GBP${NBSP}1,250.50`);
});

test('every till country has a phrase language and a currency', () => {
  for (const c of TILL_COUNTRIES) assert.ok(tillCard(TABLE, c, 12345), c);
  assert.equal(tillCard(TABLE, 'GB', 100), null);
  assert.equal(tillDigits('IDR'), 0);
  assert.equal(tillDigits('EUR'), 2);
  assert.equal(tillDigits('JPY'), 0);
});

test('prices read out with the currency word', () => {
  const say = (lang: PhraseLang, minor: number, cur: string, country?: string) => speakPrice(lang, minor, cur, country ?? null)!;
  assert.equal(say('ja', 1250, 'JPY').text, '千二百五十円');
  assert.equal(say('ja', 1250, 'JPY').kana, 'せんにひゃくごじゅうえん');
  assert.equal(say('ja', 1250, 'JPY').roman, 'sen nihyaku gojū en');
  assert.equal(say('zh-Hans', 1250, 'CNY').text, '十二元五角');
  assert.equal(say('zh-Hans', 1250, 'CNY').roman, "shí'èr yuán wǔ jiǎo");
  assert.equal(say('zh-Hans', 205, 'CNY').text, '两元零五分');
  assert.equal(say('zh-Hant', 125000, 'TWD').text, '一千兩百五十元');
  assert.equal(say('ko', 12000, 'KRW').text, '만 이천 원');
  assert.equal(say('ko', 12000, 'KRW').roman, 'man icheon won');
  assert.equal(say('th', 1250, 'THB').text, 'สิบสองบาทห้าสิบสตางค์');
  assert.equal(say('th', 1250, 'THB').roman, 'sip song baht ha sip satang');
  assert.equal(say('vi', 50000, 'VND').text, 'năm mươi nghìn đồng');
  assert.equal(say('id', 1500000, 'IDR').text, 'lima belas ribu rupiah');
  assert.equal(say('es', 1250, 'EUR', 'ES').text, 'doce euros con cincuenta');
  assert.equal(say('es', 100, 'EUR', 'ES').text, 'un euro');
  assert.equal(say('es', 2100, 'MXN', 'MX').text, 'veintiún pesos');
  assert.equal(say('es', 2100000, 'HNL', 'HN').text, 'veintiuna mil lempiras');
  assert.equal(say('es', 20000, 'HNL', 'HN').text, 'doscientas lempiras');
  assert.equal(say('es', 50, 'EUR', 'ES').text, 'cincuenta céntimos');
  assert.equal(say('fr', 1250, 'EUR', 'FR').text, 'douze euros cinquante');
  assert.equal(say('fr', 100, 'EUR', 'FR').text, 'un euro');
  assert.equal(say('fr', 7000, 'EUR', 'BE').text, 'septante euros');
  assert.equal(say('de', 100, 'EUR', 'DE').text, 'ein Euro');
  assert.equal(say('de', 1250, 'EUR', 'DE').text, 'zwölf Euro fünfzig');
  assert.equal(say('de', 3000, 'CHF', 'CH').text, 'dreissig Franken');
  assert.equal(say('it', 2150, 'EUR', 'IT').text, 'ventuno euro e cinquanta');
  assert.equal(say('it', 100, 'EUR', 'IT').text, 'un euro');
  assert.equal(say('pt', 150, 'BRL', 'BR').text, 'um real e cinquenta');
  assert.equal(say('pt', 1000, 'BRL', 'BR').text, 'dez reais');
  assert.equal(say('pt', 50, 'BRL', 'BR').text, 'cinquenta centavos');
  assert.equal(say('es', 1200, 'USD', 'EC').text, 'doce dólares');
  // No word for the currency in that language: the number, then the code.
  assert.equal(say('ja', 1200, 'USD').text, '十二 USD');
  assert.equal(speakPrice('ja', 100_000_000, 'JPY'), null);
});

test('till card: country -> currency, language, writing and reading', () => {
  const card = tillCard(TABLE, 'jp', 1250)!;
  assert.equal(card.country, 'JP');
  assert.equal(card.currency, 'JPY');
  assert.equal(card.lang, 'ja');
  assert.equal(card.written, '1,250円');
  assert.equal(card.spoken.text, '千二百五十円');
  assert.equal(card.spoken.needsCheck, true);
  assert.equal(tillCard(TABLE, 'BE', 7000)?.spoken.text, 'septante euros');
  assert.equal(tillCard(TABLE, 'JP', -1), null);
});

test('till countries: the trip first', () => {
  const o = tillCountryOrder(TABLE, ['TH', 'GB', 'JP', 'TH', null]);
  assert.deepEqual(o.fromTrip, ['TH', 'JP']);
  assert.deepEqual(o.countries.slice(0, 2), ['TH', 'JP']);
  assert.equal(new Set(o.countries).size, o.countries.length);
  assert.ok(!o.countries.includes('GB'));
});

test('typed till amounts', () => {
  assert.equal(parseTillAmount('1.250,50', 'EUR'), 125050);
  assert.equal(parseTillAmount('1,250.50', 'EUR'), 125050);
  assert.equal(parseTillAmount('12,5', 'EUR'), 1250);
  assert.equal(parseTillAmount('12', 'EUR'), 1200);
  assert.equal(parseTillAmount('1,250', 'JPY'), 1250);
  assert.equal(parseTillAmount('1 250', 'JPY'), 1250);
  assert.equal(parseTillAmount('12.5', 'JPY'), null);
  assert.equal(parseTillAmount('12345', 'IDR'), 1234500);
  assert.equal(parseTillAmount('1000000', 'JPY'), null);
  assert.equal(parseTillAmount('abc', 'EUR'), null);
  assert.equal(parseTillAmount('', 'EUR'), null);
  assert.equal(parseTillAmount('1,2,3', 'EUR'), null);
});

test('quiz: same seed, same quiz; another seed, another quiz', () => {
  const a = buildQuiz(42, ['ja', 'fr'], 'prices');
  const b = buildQuiz(42, ['ja', 'fr'], 'prices');
  assert.deepEqual(a, b);
  assert.equal(a.length, QUIZ_LENGTH);
  const c = buildQuiz(43, ['ja', 'fr'], 'prices');
  assert.notDeepEqual(a.map((q) => q.answer), c.map((q) => q.answer));
  assert.notDeepEqual(buildQuiz(42, ['ja', 'fr'], 'big'), a);
});

test('quiz: languages in turn, trip languages first', () => {
  const q = buildQuiz(7, ['th', 'vi'], 'small');
  assert.deepEqual(q.slice(0, 4).map((x) => x.lang), ['th', 'vi', 'th', 'vi']);
  assert.ok(buildQuiz(7, [], 'small').every((x) => x.lang === PHRASE_LANGS[0]));
});

test('quiz: four distinct choices in range with the answer among them, reading matches the answer', () => {
  const ranges = { small: [0, 99], prices: [100, 9999], big: [10000, 999999] } as const;
  for (const level of QUIZ_LEVELS) {
    for (let seed = 0; seed < 40; seed++) {
      for (const q of buildQuiz(seed, ['ko', 'de', 'zh-Hant'], level)) {
        assert.equal(q.choices.length, 4);
        assert.equal(new Set(q.choices).size, 4);
        assert.ok(q.choices.includes(q.answer));
        for (const c of q.choices) assert.ok(c >= ranges[level][0] && c <= ranges[level][1], `${level} ${c}`);
        assert.equal(q.reading.text, spellNumber(q.lang, q.answer)!.text);
        assert.equal(q.reading.needsCheck, true);
      }
    }
  }
});

test('quiz: the answer is not always in the same place', () => {
  const where = new Set<number>();
  for (let seed = 0; seed < 20; seed++) for (const q of buildQuiz(seed, ['ja'], 'prices')) where.add(q.choices.indexOf(q.answer));
  assert.equal(where.size, 4);
  assert.deepEqual(quizChoices(70, 'small', 5), quizChoices(70, 'small', 5));
});

test('points: right answers score 10 plus a speed bonus', () => {
  assert.equal(pointsFor(false, QUESTION_MS), 0);
  assert.equal(pointsFor(true, QUESTION_MS), 15);
  assert.equal(pointsFor(true, 0), 10);
  assert.equal(pointsFor(true, QUESTION_MS / 2), 13);
  assert.equal(pointsFor(true, -5), 10);
});

test('scores: cleaned on read, best kept, played counted', () => {
  assert.deepEqual(cleanNumbers(null), { best: {}, played: 0 });
  assert.deepEqual(cleanNumbers({ best: { 'ja:small': 40, 'xx:small': 3, 'ja:huge': 5, 'mix:big': -1, 'ko:prices': 9999 }, played: 3.7 }), {
    best: { 'ja:small': 40, 'ko:prices': 150 },
    played: 3,
  });
  const k = scoreKey('ja', 'small');
  const first = recordScore(cleanNumbers(undefined), k, 50);
  assert.equal(first.newBest, true);
  assert.equal(first.state.best[k], 50);
  const lower = recordScore(first.state, k, 30);
  assert.equal(lower.newBest, false);
  assert.equal(lower.state.best[k], 50);
  assert.equal(lower.state.played, 2);
  assert.equal(scoreKey('mix', 'big'), 'mix:big');
});

test('typed whole numbers and grouped digits', () => {
  assert.equal(parseWhole('12345'), 12345);
  assert.equal(parseWhole(' 12,345 '), 12345);
  assert.equal(parseWhole('999 999'), 999999);
  assert.equal(parseWhole('0'), 0);
  assert.equal(parseWhole('1000000'), null);
  assert.equal(parseWhole('-5'), null);
  assert.equal(parseWhole(''), null);
  assert.equal(groupedDigits(999999), '999,999');
  assert.equal(groupedDigits(1000), '1,000');
  assert.equal(groupedDigits(99), '99');
});
