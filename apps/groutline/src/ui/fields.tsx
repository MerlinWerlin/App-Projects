/** Unit-aware helpers and the catalogue pickers shared by the calculators. */
import type { TileItem } from '../countries/types.ts';
import { editableLength, formatArea, M2_PER_SQFT, parseLength, unitLabel, type LengthKind } from '../core/units.ts';
import { useApp } from '../state/AppState.tsx';
import { SPACE } from '../theme/theme.ts';
import { Field, PickerRow, Row, Txt } from './kit.tsx';
import { View } from 'react-native';

export function useUnits() {
  const { system } = useApp();
  return {
    system,
    parse: (s: string, kind: LengthKind, allowZero = false) => parseLength(s, kind, system, allowZero),
    unit: (kind: LengthKind) => unitLabel(system, kind),
    edit: (mm: number, kind: LengthKind) => editableLength(mm, system, kind),
    keyboard: system === 'metric' ? ('decimal-pad' as const) : ('numbers-and-punctuation' as const),
    roomHint: system === 'metric' ? 'mm, or add m (2.4m)' : 'feet, or 12\' 6"',
    /** Area field in the user's unit (m² or sq ft) -> m². */
    parseArea: (s: string) => { const v = Number(s.replace(/,/g, '')); return Number.isFinite(v) && v > 0 ? (system === 'metric' ? v : v * M2_PER_SQFT) : null; },
    areaUnit: system === 'metric' ? 'm²' : 'sq ft',
    showArea: (m2: number) => formatArea(m2, system),
  };
}

/** "box" -> "boxes", "carton" -> "cartons". */
export const plural = (word: string, n: number) => (n === 1 ? word : /(x|s|ch|sh)$/.test(word) ? `${word}es` : `${word}s`);
export const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export interface TileFields { tileId: string; tileL: string; tileW: string; tileT: string; perBox: string; boxArea: string }

export function tileFieldsFrom(item: TileItem, system: 'metric' | 'imperial'): Omit<TileFields, 'tileId'> {
  return {
    tileL: editableLength(item.lengthMm, system, 'tile'),
    tileW: editableLength(item.widthMm, system, 'tile'),
    tileT: system === 'metric' ? String(item.thicknessMm) : editableLength(item.thicknessMm, system, 'tile'),
    perBox: item.perBox ? String(item.perBox) : '',
    boxArea: item.boxM2 ? (system === 'metric' ? String(Math.round(item.boxM2 * 1000) / 1000) : String(Math.round((item.boxM2 / M2_PER_SQFT) * 100) / 100)) : '',
  };
}

/** Tile picker (country catalogue first, custom always available) plus the editable size fields. */
export function TileInputs({ value, onChange, showBox = true, showThickness = false, filter }: {
  value: TileFields; onChange(p: Partial<TileFields>): void; showBox?: boolean; showThickness?: boolean; filter?: 'floor' | 'wall';
}) {
  const { country } = useApp();
  const u = useUnits();
  const items = country.catalogue.tiles.filter(x => !filter || x.use === 'both' || x.use === filter);
  const sel = country.catalogue.tiles.find(x => x.id === value.tileId) ?? null;
  const box = country.terms.box;
  return (
    <View style={{ gap: SPACE.sm }}>
      <PickerRow
        label="Tile"
        value={sel ? sel.label : 'Custom size'}
        sub={sel ? [sel.perBox ? `${sel.perBox} per ${box}` : null, sel.boxM2 ? `${u.showArea(sel.boxM2)} per ${box}` : null, sel.note].filter(Boolean).join(' · ') : 'Type the size off the box'}
        options={items.map(x => ({ id: x.id, title: x.label, sub: [x.use === 'both' ? 'Floor and wall' : x.use === 'floor' ? 'Floor' : 'Wall', x.perBox ? `${x.perBox} per ${box}` : null, x.boxM2 ? `${u.showArea(x.boxM2)} per ${box}` : null, x.note].filter(Boolean).join(' · ') }))}
        selected={sel?.id ?? null}
        onSelect={id => {
          const item = country.catalogue.tiles.find(x => x.id === id);
          onChange(item ? { tileId: item.id, ...tileFieldsFrom(item, u.system) } : { tileId: '' });
        }}
      />
      <Row>
        <Field label="Tile length" value={value.tileL} onChangeText={v => onChange({ tileL: v, tileId: '' })} unit={u.unit('tile')} keyboard={u.keyboard} />
        <Field label="Tile width" value={value.tileW} onChangeText={v => onChange({ tileW: v, tileId: '' })} unit={u.unit('tile')} keyboard={u.keyboard} />
        {showThickness ? <Field label="Thickness" value={value.tileT} onChangeText={v => onChange({ tileT: v, tileId: '' })} unit={u.unit('tile')} keyboard={u.keyboard} /> : null}
      </Row>
      {showBox ? (
        <Row>
          <Field label={`Tiles per ${box}`} value={value.perBox} onChangeText={v => onChange({ perBox: v, tileId: '' })} keyboard="number-pad" hint="Optional" />
          <Field label={`${u.areaUnit} per ${box}`} value={value.boxArea} onChangeText={v => onChange({ boxArea: v, tileId: '' })} unit={u.areaUnit} keyboard="decimal-pad" hint="Optional" />
        </Row>
      ) : null}
      {sel?.verified === false ? <Txt v="footnote" tone="ink3">Box details for this size weren't fully confirmed: check the label.</Txt> : null}
    </View>
  );
}
