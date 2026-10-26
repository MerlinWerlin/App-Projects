// Real editor payload for the Swift decoder contract check (no dependencies, no device data).
import { writeFileSync } from 'node:fs';
import { THEMES } from '../src/core/themes.ts';
import { generateWidgetSet } from '../src/core/widgetSets.ts';
import { generateWidgetCatalogue } from '../src/core/widgetKinds.ts';
import { initialStudioState, selectCatalogueWidget, updateCatalogueDraft, studioCataloguePayload, updateDraft, setDraftText } from '../src/core/widgetStudio.ts';
const theme = THEMES[0];
const set = generateWidgetSet(theme);
let state = initialStudioState(set, 'quote', 'small');
state = updateDraft(set, state, { background: { kind: 'gradient', from: '#112233', to: '#445566' } });
const text = set.specs.find(s => s.kind === 'quote' && s.size === 'small').regions.find(r => r.text?.editable);
state = setDraftText(set, state, text.id, 'Keep my words');
state = selectCatalogueWidget(state, 'monthProgress', 'small');
state = updateCatalogueDraft(state, { background: { kind: 'gradient', from: '#AABBCC', to: '#DDEEFF' } });
writeFileSync(process.argv[2], studioCataloguePayload(set, generateWidgetCatalogue(theme), state));
