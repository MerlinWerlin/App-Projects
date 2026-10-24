#!/usr/bin/env python3
"""Letters (owner 24 Oct 2026): writes src/i18n/packs/letters.ts (template names in the 10 non-English locales) and
prints nothing else. Names follow one pattern per locale: <style> <character>, with capital/small for styles that have
both cases. Machine translation awaiting native review (T46), like the other packs.

Usage: python3 scripts/letters-i18n.py   (reads src/core/templateArt/letters/*.ts)
"""
import glob
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')

# style id -> {locale: name}; English names live in the templates themselves.
STYLE = {
    'bubble': {'es': 'Burbuja', 'fr': 'Bulle', 'de': 'Blase', 'it': 'Bolla', 'pt-BR': 'Bolha', 'ja': 'バブル', 'ko': '버블', 'zh-Hans': '泡泡', 'hi': 'बबल', 'ar': 'فقاعي'},
    'retro': {'es': 'Retro', 'fr': 'Rétro', 'de': 'Retro', 'it': 'Rétro', 'pt-BR': 'Retrô', 'ja': 'レトロ', 'ko': '레트로', 'zh-Hans': '复古', 'hi': 'रेट्रो', 'ar': 'ريترو'},
    'calligraphy': {'es': 'Caligrafía', 'fr': 'Calligraphie', 'de': 'Kalligrafie', 'it': 'Calligrafia', 'pt-BR': 'Caligrafia', 'ja': 'カリグラフィー', 'ko': '캘리그라피', 'zh-Hans': '书法', 'hi': 'कैलिग्राफी', 'ar': 'خط زخرفي'},
    'script': {'es': 'Cursiva', 'fr': 'Script', 'de': 'Schreibschrift', 'it': 'Corsivo', 'pt-BR': 'Cursiva', 'ja': 'スクリプト', 'ko': '스크립트', 'zh-Hans': '花体', 'hi': 'स्क्रिप्ट', 'ar': 'خط متصل'},
    'pixel': {'es': 'Píxel', 'fr': 'Pixel', 'de': 'Pixel', 'it': 'Pixel', 'pt-BR': 'Pixel', 'ja': 'ピクセル', 'ko': '픽셀', 'zh-Hans': '像素', 'hi': 'पिक्सेल', 'ar': 'بكسل'},
    'graffiti': {'es': 'Grafiti', 'fr': 'Graffiti', 'de': 'Graffiti', 'it': 'Graffiti', 'pt-BR': 'Grafite', 'ja': 'グラフィティ', 'ko': '그래피티', 'zh-Hans': '涂鸦', 'hi': 'ग्रैफिटी', 'ar': 'غرافيتي'},
    'blackletter': {'es': 'Gótica', 'fr': 'Gothique', 'de': 'Fraktur', 'it': 'Gotico', 'pt-BR': 'Gótica', 'ja': 'ブラックレター', 'ko': '블랙레터', 'zh-Hans': '哥特体', 'hi': 'ब्लैकलेटर', 'ar': 'قوطي'},
    'serif': {'es': 'Serif clásica', 'fr': 'Serif classique', 'de': 'Klassische Serif', 'it': 'Serif classico', 'pt-BR': 'Serifa clássica', 'ja': 'クラシックセリフ', 'ko': '클래식 세리프', 'zh-Hans': '经典衬线', 'hi': 'क्लासिक सेरिफ़', 'ar': 'كلاسيكي مذيل'},
    'stencil': {'es': 'Plantilla', 'fr': 'Pochoir', 'de': 'Schablone', 'it': 'Stencil', 'pt-BR': 'Estêncil', 'ja': 'ステンシル', 'ko': '스텐실', 'zh-Hans': '镂空', 'hi': 'स्टेंसिल', 'ar': 'استنسل'},
    'western': {'es': 'Western', 'fr': 'Western', 'de': 'Western', 'it': 'Western', 'pt-BR': 'Faroeste', 'ja': 'ウエスタン', 'ko': '웨스턴', 'zh-Hans': '西部', 'hi': 'वेस्टर्न', 'ar': 'غربي'},
    'deco': {'es': 'Art déco', 'fr': 'Art déco', 'de': 'Art déco', 'it': 'Art déco', 'pt-BR': 'Art déco', 'ja': 'アールデコ', 'ko': '아르데코', 'zh-Hans': '装饰艺术', 'hi': 'आर्ट डेको', 'ar': 'آرت ديكو'},
    'handwritten': {'es': 'A mano', 'fr': 'Manuscrit', 'de': 'Handschrift', 'it': 'A mano', 'pt-BR': 'À mão', 'ja': '手書き', 'ko': '손글씨', 'zh-Hans': '手写', 'hi': 'हस्तलिखित', 'ar': 'بخط اليد'},
    'neon': {'es': 'Neón', 'fr': 'Néon', 'de': 'Neon', 'it': 'Neon', 'pt-BR': 'Neon', 'ja': 'ネオン', 'ko': '네온', 'zh-Hans': '霓虹', 'hi': 'नियॉन', 'ar': 'نيون'},
    'typewriter': {'es': 'Máquina de escribir', 'fr': 'Machine à écrire', 'de': 'Schreibmaschine', 'it': 'Macchina da scrivere', 'pt-BR': 'Máquina de escrever', 'ja': 'タイプライター', 'ko': '타자기', 'zh-Hans': '打字机', 'hi': 'टाइपराइटर', 'ar': 'آلة كاتبة'},
    'block': {'es': 'Bloque', 'fr': 'Bloc', 'de': 'Block', 'it': 'Blocco', 'pt-BR': 'Bloco', 'ja': 'ブロック', 'ko': '블록', 'zh-Hans': '方块', 'hi': 'ब्लॉक', 'ar': 'كتلي'},
    'marker': {'es': 'Rotulador', 'fr': 'Marqueur', 'de': 'Marker', 'it': 'Pennarello', 'pt-BR': 'Marcador', 'ja': 'マーカー', 'ko': '마커', 'zh-Hans': '马克笔', 'hi': 'मार्कर', 'ar': 'قلم عريض'},
    'words': {'es': 'Palabras y frases', 'fr': 'Mots et phrases', 'de': 'Wörter und Sprüche', 'it': 'Parole e frasi', 'pt-BR': 'Palavras e frases', 'ja': '言葉とフレーズ', 'ko': '단어와 문구', 'zh-Hans': '字词与短语', 'hi': 'शब्द और वाक्य', 'ar': 'كلمات وعبارات'},
}

# '{s}' = style, '{c}' = character
CAPITAL = {'es': '{s} {c} mayúscula', 'fr': '{s} {c} majuscule', 'de': '{s} Großbuchstabe {c}', 'it': '{s} {c} maiuscola', 'pt-BR': '{s} {c} maiúscula', 'ja': '{s} 大文字{c}', 'ko': '{s} 대문자 {c}', 'zh-Hans': '{s} 大写{c}', 'hi': '{s} कैपिटल {c}', 'ar': '{s} {c} كبير'}
SMALL = {'es': '{s} {c} minúscula', 'fr': '{s} {c} minuscule', 'de': '{s} Kleinbuchstabe {c}', 'it': '{s} {c} minuscola', 'pt-BR': '{s} {c} minúscula', 'ja': '{s} 小文字{c}', 'ko': '{s} 소문자 {c}', 'zh-Hans': '{s} 小写{c}', 'hi': '{s} स्मॉल {c}', 'ar': '{s} {c} صغير'}
PLAIN = {loc: '{s} {c}' for loc in CAPITAL}
LOCALES = list(CAPITAL)


def main():
    out = {loc: {} for loc in LOCALES}
    for f in sorted(glob.glob(os.path.join(ROOT, 'src/core/templateArt/letters/*.ts'))):
        if f.endswith('index.ts'):
            continue
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line.startswith('{'):
                continue
            t = json.loads(line.rstrip(','))
            style = next(tag[6:] for tag in t['tags'] if tag.startswith('style-'))
            key = t['id'][len(f'char-{style}-'):]
            mixed = ' capital ' in t['name'] or ' small ' in t['name']
            sym = {'ampersand': '&', 'exclamation': '!', 'question': '?'}
            if key in sym:
                ch, pat = sym[key], PLAIN
            elif key.endswith('-small'):
                ch, pat = key[0], SMALL
            elif mixed and key.isalpha():
                ch, pat = key.upper(), CAPITAL
            else:
                ch, pat = key.upper(), PLAIN
            for loc in LOCALES:
                out[loc][f"templates.name.{t['id']}"] = pat[loc].format(s=STYLE[style][loc], c=ch)
    lines = [
        '// Name translations for the Letters templates (owner 24 Oct 2026). GENERATED by scripts/letters-i18n.py:',
        '// <style> <character>, capital/small where a style has both cases. Machine translation awaiting native review (T46).',
        "import type { PackNames } from './index.ts';",
        '',
        'export const lettersNames: PackNames = {',
    ]
    for loc in LOCALES:
        lines.append(f'  {json.dumps(loc)}: {{')
        for k, v in out[loc].items():
            lines.append(f'    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},')
        lines.append('  },')
    lines.append('};')
    with open(os.path.join(ROOT, 'src/i18n/packs/letters.ts'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('names per locale:', len(out['es']))


if __name__ == '__main__':
    main()
