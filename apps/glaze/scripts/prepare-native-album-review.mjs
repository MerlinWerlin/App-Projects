import {readFileSync, writeFileSync} from 'node:fs';
import {generateWidgetSetFromTokens, tokensFromWidgetTheme} from '../src/core/widgetSets.ts';
import {buildCatalogueSpec, applyCatalogueEdits, serialiseWidgetCatalogue} from '../src/core/widgetKinds.ts';
import {TRANSLATIONS} from '../src/i18n/locales/index.ts';
import {en} from '../src/i18n/locales/en.ts';
import {lookup} from '../src/core/i18n.ts';
const ids = ['001-alpine-starlight','005-rainlight','014-frostglass-passage','025-lavender-nocturne','062-froggy-picnic','063-boba-bear-club'];
const profiles = JSON.parse(readFileSync('docs/native-habit-review-profiles.json','utf8')).themes.filter(t => ids.includes(t.id));
if (profiles.length !== 6) throw Error('Missing review palette');
const cases = [];
for (const [language, translations] of Object.entries({en,...TRANSLATIONS})) for (const theme of profiles) for (const size of ['small','medium','large']) {
  const tokens = tokensFromWidgetTheme(theme.nativeTheme), set = generateWidgetSetFromTokens(tokens);
  const {spec} = applyCatalogueEdits(buildCatalogueSpec(tokens,'photoAlbum',size), {rotateMinutes:15});
  const payload = JSON.parse(serialiseWidgetCatalogue(set,{themeId:tokens.themeId,name:tokens.name,tokens,specs:[spec]},
    {translate: k => lookup(translations,k) ?? k, now:new Date('2026-11-04T00:00:00Z')}));
  cases.push({id:`${language}_${theme.id}_${size}`,language,size,nativeTheme:theme.nativeTheme,raw:payload.catalogue.specs[0],texts:payload.catalogue.texts[spec.id]});
}
writeFileSync(process.argv[2] ?? 'docs/native-album-review.json', JSON.stringify({schema:'GLAZE_ALBUM_EDITOR_FIXTURES_V1',cases})+'\n');
console.log('Prepared',cases.length,'real editor album designs');
