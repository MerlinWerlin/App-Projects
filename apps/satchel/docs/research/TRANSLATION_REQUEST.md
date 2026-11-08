# Translations: request for the Satchel OpenAI lanes (T21)

Written 2026-11-01 by Satchel build run 115. The app is ready to take Spanish (es), French (fr), German (de) and
Japanese (ja). The 26 Oct lane files in `_spec\i18n\` cannot be used: they translate the old spec string list, and only
33 of their keys exist in the app. This request replaces them.

## What to translate

The build run writes the app's whole English catalogue, split into chunks of about 400 strings, to
`Desktop\Apps\satchel\_spec\i18n_request\en.01.json` ... `en.NN.json` (regenerated from the app on every PC refresh;
`node tools/i18n/import-locale.mjs chunks` makes the same files inside the repo). Each chunk is a flat JSON object
`{ "key": "English text" }`.

For each language and each chunk, write a file with **the same keys** and the translated text:
`Desktop\Apps\satchel\_drops\i18n\<lang>\<lang>.NN.json` (for example `_drops\i18n\ja\ja.03.json`), and add one entry
per file to `_drops\i18n\MANIFEST.json` with `"imported_by_build": null`.

## Rules (the build run's importer rejects any line that breaks them)

1. Keep every key exactly; never add, drop or rename keys.
2. Keep every `{placeholder}` exactly as written (same names, same count; order may change to suit the grammar).
3. Keep the words **Satchel** and **OpenStreetMap** exactly as written.
4. No empty strings. Keep `\n` line breaks where the English has them.
5. Plain, friendly, short. These are button labels and phone-screen lines: if the English is short, keep the
   translation short (German and French run long; prefer the shorter natural wording).
6. Use the informal "you" where the language allows a friendly app tone (es *tú*, fr *vous* is fine, de *du*,
   ja polite *desu/masu*).
7. Never translate country names, city names or phone numbers differently from how the language normally writes them.
8. Emergency and medical lines (`emergency.*`, `trouble.*`, `helpcards.*`, `menu.*`, `meds.*`) must keep their exact
   meaning; if unsure, translate literally and list the key in a `NOTES.md` beside the files.
9. Never use another app's or company's name.

## How the build run imports them

`node tools/i18n/import-locale.mjs <lang> <files...>` checks every line (known key, same placeholders, the two kept
words, not empty), merges the chunks, and bundles the language only when it covers at least 95% of the app's strings,
so nobody sees half-English screens. Settings > Language then offers it, and the first-launch language line points
to it. Accepted languages need a native-speaker spot check before release (recorded in `ops/DECISIONS.md`).
