import { writeFileSync } from 'node:fs';
import { EXTRAORDINARY_RECIPES } from '../src/core/extraordinaryThemeIdentities.ts';
import { identityForTheme } from '../src/core/widgetIdentity.ts';

const identities = [...Object.keys(EXTRAORDINARY_RECIPES), 'alpine-starlight'].map(id => ({ id, identity: identityForTheme(id) }));
const control = { ...identities[0].identity, ornament: 'M 12 64 L 50 18 L 88 64 M 28 64 Q 50 84 72 64' };
const { ornament: _ornament, ...legacy } = control;
const invalid = [null, '', 'M 1 2 L3 4', 'M 1 2 3 4', 'M 1 2 C 3 4', 'M 126 1 L 2 3', 'M 1 2 A 3 4', '<script>', 'M ' + '1 '.repeat(1300)];
writeFileSync(process.argv[2], JSON.stringify({ identities, control, legacy, invalid }));
