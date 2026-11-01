# Phrase cards (T56): source and checks

`src/content/phrases.json` (16 phrases × 12 languages: ja, zh-Hans, zh-Hant (T58), ko, th, vi, es, fr, de, it, pt, id) was **written by the model (Claude), not by a native speaker. Check every line with a native speaker before calling it verified.** The app says so under the list.

- Polite, standard forms throughout. Where a language marks the speaker's gender, the card avoids it or shows both forms.
- Pronunciation (`roman`) only for non-Latin scripts: Hepburn with long-vowel marks (ja), Hanyu Pinyin with tone marks (zh-Hans), Revised Romanization (ko), simple RTGS **without tone marks** (th). It's a rough guide; the card is meant to be shown, not read aloud.
- "I have an allergy" stays general; since T58 the traveller can pick allergens and the card lists them underneath in the card's language (see below).
- Country → language mapping is in the same file (`countries`); each country maps to one language only. Since T58 Taiwan, Hong Kong and Macau map to Traditional Chinese (zh-Hant), mainland China to Simplified; Switzerland maps to German.

## Lines I was unsure of

| Lang | Phrase | Text | Doubt |
|---|---|---|---|
| th | all | …ครับ/ค่ะ (คะ in questions) | The polite particle depends on the speaker's gender, so both are shown with a slash. Native readers know the phrasebook convention, but it looks odd on a card. |
| th | doctor | ต้องการหมอครับ/ค่ะ | Terse (no pronoun, to avoid gendered ผม/ฉัน). "ช่วยเรียกหมอให้หน่อย" (please call a doctor) may be better. |
| th | allergy | มีอาการแพ้ครับ/ค่ะ | Natural Thai usually names the allergen (แพ้ …). |
| th | address | ช่วยไปส่งที่อยู่นี้หน่อยครับ/ค่ะ | Taxi phrasing; "ไปที่อยู่นี้" is shorter. |
| th | noThanks | ไม่เป็นไร ขอบคุณครับ/ค่ะ | ไม่เป็นไร also means "never mind"; ไม่ต้องครับ/ค่ะ may decline an offer more clearly. |
| th | romanisation | — | No tone marks, so it won't be pronounced correctly from the guide alone. |
| zh-Hans | allergy | 我有过敏症。 | 我过敏 or 我对…过敏 may be more natural. |
| zh-Hans | station | 车站在哪里？ | Ambiguous: train station is 火车站, metro station 地铁站. |
| zh-Hans | police | 请帮我叫警察。 | 请报警 is also common. |
| ja | doctor | 医者が必要です。 | Understandable but stiff; 医者を呼んでください (please call a doctor) may be more useful. |
| ja | help | 助けてください！ | Polite form chosen; the shout in an emergency is 助けて！ |
| ko | excuseMe | 실례합니다 | To get a waiter's or passer-by's attention 저기요 is more usual. |
| ko | speakEnglish | 영어 하실 수 있으세요? | Honorific; check it reads naturally. |
| vi | speakEnglish | Bạn có nói tiếng Anh không? | "Bạn" is a casual "you"; the right pronoun depends on age/gender (anh/chị/em). |
| vi | water / bill | Cho tôi xin nước. / Làm ơn tính tiền. | Check these are the everyday forms in restaurants. |
| vi | help | Cứu tôi với! | "Cứu với!" is also common. |
| es | toilet | ¿Dónde está el baño? | Spain also says "los servicios" / "el aseo"; baño is understood everywhere. |
| es | lost | Me he perdido. | Spain-style perfect, chosen to avoid gendered perdido/perdida; Latin America says "Me perdí". |
| pt | toilet | Onde fica o banheiro? | Brazilian. Portugal says "a casa de banho". |
| pt | thanks / noThanks | Obrigado / Obrigada | Gendered by the speaker, both shown. |
| pt | lost | Não sei onde estou. | Literally "I don't know where I am" (avoids gendered perdido/perdida). |
| fr | lost | Je ne trouve pas mon chemin. | "I can't find my way", to avoid gendered "perdu(e)". |
| it | lost | Non trovo la strada. | Same reason ("perso/persa"). |
| de | hello | Guten Tag | In Bavaria and Austria "Grüß Gott" is usual; Guten Tag is still fine. |
| id | water / bill | Minta air putih. / Minta bonnya. | Colloquial restaurant forms; check that they're polite enough. |
| id | hello | Halo | Casual; "Selamat pagi/siang/sore/malam" depends on the time of day. |

Language names in the picker are UI strings (`phrases.lang.*` in `src/i18n/en/phrases.ts`); the native names are in the JSON.

## T58 additions (run 85): NEEDS A NATIVE-SPEAKER CHECK

Everything in this section was written by the model (Claude), not a native speaker, and **must be checked by a native speaker before it is called verified**. The allergy card in the app says so under the allergen list.

### Traditional Chinese (`zh-Hant`, 繁體中文) for TW / HK / MO — needs a native-speaker check

- All 16 phrases plus the 9 allergens, in Traditional characters with **Taiwan-standard** wording and character forms (說 not 説, 裡 not 裏, 英文 not 英語, 結帳, 黃豆). A test fails if any Simplified-only form used on the zh-Hans card turns up on the zh-Hant card.
- Pronunciation is **Mandarin** Hanyu Pinyin (Taiwan reading: 多少 duōshǎo). Hong Kong and Macau speak Cantonese: the card is written standard Chinese, which reads fine there, but the pinyin guide is not how to say it in Cantonese. A Cantonese guide (Jyutping) and Hong Kong wording (e.g. 唔該, 埋單) would be a separate language entry.

| Phrase | Text | Doubt |
|---|---|---|
| toilet | 請問洗手間在哪裡？ | 廁所 is also everyday in Taiwan; 洗手間 is the polite choice. |
| speakEnglish | 您會說英文嗎？ | 您 is polite; most Taiwanese would say 你 in casual speech. |
| allergy | 我有過敏症。 | Same doubt as zh-Hans: 我會過敏 / 我對…過敏 may be more natural. |
| bill | 請幫我結帳。 | 買單 is also common, especially in Hong Kong. |
| station | 車站在哪裡？ | Ambiguous: 火車站 (rail), 捷運站 (Taipei metro), 港鐵站 (Hong Kong MTR). |

### Allergen slot (9 allergens × 12 languages) — needs a native-speaker check

Allergens: peanuts, tree nuts, shellfish, fish, milk, egg, wheat / gluten, soy, sesame. The card shows "I have an allergy." then each picked allergen in the local language with its English name (and pronunciation for non-Latin scripts). The list layout avoids building "I'm allergic to X and Y" sentences, whose grammar differs per language. Where regional words differ, both are shown.

| Lang | Allergen | Text | Doubt |
|---|---|---|---|
| ja | tree nuts | ナッツ類 | Labels in Japan list くるみ, アーモンド, カシューナッツ separately; ナッツ類 is the general word. |
| ja | shellfish | エビ・カニ・貝類 | Spelled out (prawn, crab, shellfish) rather than the label term 甲殻類. |
| zh-Hans / zh-Hant | tree nuts | 坚果 / 堅果 | Can be read to include peanuts; check whether 树坚果 / 樹堅果 is clearer on a card. |
| zh-Hant | soy | 黃豆（大豆） | 黃豆 is everyday Taiwanese; 大豆 is the label word. |
| ko | shellfish | 새우·게·조개류 | Spelled out rather than 갑각류 (crustaceans). |
| th | milk | นมวัว | "Cow's milk"; check it covers dairy in general (ผลิตภัณฑ์นม). |
| th | wheat | ข้าวสาลี (กลูเตน) | Check กลูเตน is understood in restaurants. |
| vi | peanuts / sesame | Lạc (đậu phộng) / Vừng (mè) | North and South words both shown. |
| vi | tree nuts | Các loại hạt | "All kinds of nuts/seeds"; may be too broad. |
| es | peanuts / tree nuts | Cacahuetes / maní; Frutos secos (nueces) | Spain vs Latin America both shown; Mexico says cacahuate. Frutos secos can also mean dried fruit in places. |
| es | sesame | Sésamo (ajonjolí) | Both regional words shown. |
| fr | shellfish | Crustacés et coquillages | Label term for molluscs is mollusques. |
| de | tree nuts / shellfish | Nüsse (Schalenfrüchte); Krebstiere und Muscheln | Label terms; "Weichtiere" is the formal word for molluscs. |
| it | wheat | Grano (glutine) | Frumento is the label word. |
| pt | shellfish / sesame | Frutos do mar / marisco; Gergelim (sésamo) | Brazil vs Portugal both shown. |
| pt | tree nuts | Castanhas e nozes | Portugal's label term is frutos de casca rija. |
| id | tree nuts | Kacang almond, kenari, mete | Examples rather than a single word; check a native speaker's preferred term. |
| id | shellfish | Udang, kepiting, kerang | Spelled out. |

## T110 menu words (run 97): TO NATIVE-CHECK

`src/content/menu.json` (menu helper, `app/menu.tsx`) was **written by the model (Claude), not by a native speaker. Check every word with a native speaker before calling it verified.** The screen says so under the list and shows "General guidance only - always tell staff about allergies" at the top and on every word card.

- 131 concepts; words per language: ja 127, zh-Hans 124, ko 123, th 119, vi 121, fr 122, it 121, es 122, de 122, pt 121. Where I was not confident of a word in a language it was left out rather than guessed (e.g. th pistachio / hazelnut / pasta, vi mayonnaise / shellfish, ko beans, roasted in zh / ko).
- Categories: meat, fish and seafood, eggs and dairy, nuts / soy / wheat and other allergens, vegetables and fruit, rice / noodles / dishes, cooking methods, spice level and taste, drinks, diet words (vegetarian, vegan, halal, gluten-free, no meat; Thai เจ).
- `flags` say what a food **usually** contains (pork, beef, poultry, fish, shellfish, egg, dairy, peanuts, tree nuts, gluten, soy, sesame, alcohol, honey); pork, beef and poultry imply meat. Dishes vary, so the flags are prompts to ask, not a guarantee.
- Romanisation as for the phrase cards: Hepburn with long-vowel marks (ja), Hanyu Pinyin with tone marks (zh-Hans, dictionary tones: 不辣 bù là), Revised Romanization (ko), simple RTGS without tone marks (th). Vietnamese stays in its own Latin script with diacritics. Regional alternatives are in brackets (es Spain / Latin America, pt Brazil / Portugal, vi North / South).
- No Traditional Chinese (TW / HK / MO) or Indonesian menu words yet; links there are hidden.

| Lang | Word | Text | Doubt |
|---|---|---|---|
| ja | cooking methods | 焼き / 蒸し / 茹で / 炒め | Menu fragments (as in 焼き魚, 野菜炒め) rather than standalone words. |
| ja | MSG | 化学調味料 | Seen as "化学調味料不使用"; うま味調味料 is the newer label word. |
| zh-Hans | almonds | 杏仁 | Also means apricot kernel (杏仁豆腐); 扁桃仁 / 巴旦木 is the strict word. |
| zh-Hans | cream | 奶油 | Also used for butter-cream; 淡奶油 is whipping cream. |
| ko | soy | 대두 | Label word; everyday 콩 also means beans in general. |
| ko | kimchi | 김치 | Flagged fish / shellfish because most recipes use fish sauce or salted shrimp; check per restaurant. |
| th | noodles | ก๋วยเตี๋ยว | Listed under rice noodles (usually rice); egg noodles are บะหมี่ (not included). |
| th | vegetarian / jay | มังสวิรัติ / เจ | เจ (yellow flag) is stricter: no meat, dairy, eggs, garlic or onion. |
| vi | butter | bơ | Also avocado (quả bơ); context makes it clear on a menu. |
| vi | vegetarian | chay | Also covers vegan-style Buddhist food; thuần chay is strict vegan. |
| fr | bacon | lardons (bacon) | Lardons are bacon pieces; "bacon" in France is often cured loin. |
| es | beef | ternera (res) | Spain ternera, Latin America res / carne de res. |
| de | roasted | gebraten | Also "fried"; gebacken / im Ofen for baked. |
| de | crab | Krabbe | In northern Germany Krabben are often brown shrimp. |
| pt | ham | presunto | Brazil: cooked ham; Portugal: cured ham (fiambre = cooked). |
| it | rice noodles | spaghetti di riso | Also "noodles di riso" on menus. |
