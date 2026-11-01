// T229: writes native-plugins/queryschemes.json (Info.plist LSApplicationQueriesSchemes) from the
// core list in src/core/installedProbe.ts. Run after changing that list:
//   node scripts/gen-query-schemes.mjs
// src/core/installedProbe.test.ts fails while the JSON and the core list differ.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemesToQuery } from '../src/core/installedProbe.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'native-plugins', 'queryschemes.json');
const json = { infoPlist: { LSApplicationQueriesSchemes: schemesToQuery() } };
writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`);
console.log(`wrote ${out} (${json.infoPlist.LSApplicationQueriesSchemes.length} schemes)`);
