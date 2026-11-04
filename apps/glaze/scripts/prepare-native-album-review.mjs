import {readFileSync, writeFileSync} from 'node:fs';
import {generateWidgetSetFromTokens, tokensFromWidgetTheme} from '../src/core/widgetSets.ts';
import {buildCatalogueSpec, applyCatalogueEdits, serialiseWidgetCatalogue} from '../src/core/widgetKinds.ts';
import {TRANSLATIONS} from '../src/i18n/locales/index.ts';
import {en} from '../src/i18n/locales/en.ts';
import {lookup} from '../src/core/i18n.ts';
const ids = ['001-alpine-starlight','005-rainlight','014-frostglass-passage','025-lavender-nocturne','062-froggy-picnic','063-boba-bear-club'];
const palettes = JSON.parse(readFileSync('docs/native-habit-review-profiles.json','utf8')).themes;
const profiles = palettes.filter(t => ids.includes(t.id));
if (profiles.length !== 6) throw Error('Missing review palette');
const cases = [];
const longCaptions = {
  en:'Our favourite places, people and little moments', ar:'لحظاتنا الجميلة والأماكن التي نحب العودة إليها',
  de:'Unsere liebsten Orte und besonderen Erinnerungen', es:'Nuestros lugares favoritos y pequeños momentos',
  fr:'Nos lieux préférés et nos petits moments ensemble', hi:'हमारी पसंदीदा जगहें और साथ बिताए अनमोल पल',
  it:'I nostri posti preferiti e i piccoli momenti insieme', ja:'大切な人と過ごした時間と、また訪れたい思い出の場所を集めました',
  ko:'소중한 사람들과 함께한 순간과 다시 가고 싶은 우리의 장소들', 'pt-BR':'Nossos lugares favoritos e pequenos momentos juntos',
  'zh-Hans':'收藏和重要的人一起度过的美好时光，以及那些希望再次前往的地方',
};
for (const [language, translations] of Object.entries({en,...TRANSLATIONS})) for (const theme of profiles) for (const size of ['small','medium','large']) {
  const tokens = tokensFromWidgetTheme(theme.nativeTheme), set = generateWidgetSetFromTokens(tokens);
  const {spec} = applyCatalogueEdits(buildCatalogueSpec(tokens,'photoAlbum',size), {rotateMinutes:15,
    ...(ids.indexOf(theme.id) % 2 ? {text:{caption:longCaptions[language]}} : {})});
  const payload = JSON.parse(serialiseWidgetCatalogue(set,{themeId:tokens.themeId,name:tokens.name,tokens,specs:[spec]},
    {translate: k => lookup(translations,k) ?? k, now:new Date('2026-11-04T00:00:00Z')}));
  cases.push({id:`${language}_${theme.id}_${size}`,language,size,nativeTheme:theme.nativeTheme,raw:payload.catalogue.specs[0],texts:payload.catalogue.texts[spec.id]});
}
writeFileSync(process.argv[2] ?? 'docs/native-album-review.json', JSON.stringify({schema:'GLAZE_ALBUM_EDITOR_FIXTURES_V1',cases,palettes:palettes.map(t=>t.nativeTheme)})+'\n');
console.log('Prepared',cases.length,'real editor album designs');
