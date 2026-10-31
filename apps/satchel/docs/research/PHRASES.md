# Phrase cards (T56): source and checks

`src/content/phrases.json` (16 phrases × 11 languages: ja, zh-Hans, ko, th, vi, es, fr, de, it, pt, id) was **written by the model (Claude), not by a native speaker. Check every line with a native speaker before calling it verified.** The app says so under the list.

- Polite, standard forms throughout. Where a language marks the speaker's gender, the card avoids it or shows both forms.
- Pronunciation (`roman`) only for non-Latin scripts: Hepburn with long-vowel marks (ja), Hanyu Pinyin with tone marks (zh-Hans), Revised Romanization (ko), simple RTGS **without tone marks** (th). It's a rough guide; the card is meant to be shown, not read aloud.
- "I have an allergy" stays general on purpose (no allergen); a fill-in allergen card could come later.
- Country → language mapping is in the same file (`countries`); each country maps to one language only. Taiwan, Hong Kong and Macau are left unmapped on purpose (they use Traditional characters); Switzerland maps to German.

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
