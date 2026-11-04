import { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { hexToHsv, hsvToHex, normalizeHex } from '../core/colors';
import { t } from '../i18n';
import { radius, space, type as ty, useColors } from '../theme/tokens';
import { Button, IconButton } from './kit';

/** A touch/VoiceOver adjustable colour strip; no extra native dependency. */
function ColourStrip({ label, value, onChange, stops }: { label: string; value: number; onChange: (v: number) => void; stops: string[] }) {
  const { c } = useColors();
  const [width, setWidth] = useState(1);
  const change = (x: number) => onChange(Math.max(0, Math.min(1, x / width)));
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[ty.small, { color: c.ink2 }]}>{label}</Text>
      <View
        accessible accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => change(e.nativeEvent.locationX)} onResponderMove={(e) => change(e.nativeEvent.locationX)}
        style={{ height: 48, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ height: 30, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}>
          <Svg width="100%" height="100%"><Defs><LinearGradient id="strip" x1="0" y1="0" x2="1" y2="0">
            {stops.map((color, i) => <Stop key={i} offset={i / (stops.length - 1)} stopColor={color} />)}
          </LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#strip)" /></Svg>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, Math.min(width - 24, value * width - 12)), width: 24, height: 40, borderRadius: 12, borderWidth: 3, borderColor: c.ink, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      </View>
    </View>
  );
}

/** Mounted afresh on each opening so Cancel never changes the active colour. */
export function ColourPicker({ initial, onClose, onChoose }: { initial: string; onClose: () => void; onChoose: (color: string) => void }) {
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [draft, setDraft] = useState(initial);
  const valid = normalizeHex(draft);
  const preview = valid ?? hsvToHex(hsv);
  function adjust(patch: Partial<typeof hsv>) {
    const next = { ...hsv, ...patch };
    setHsv(next); setDraft(hsvToHex(next));
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <Text style={[ty.h2, { color: c.ink, flex: 1 }]} accessibilityRole="header">{t('colour.custom')}</Text>
          <IconButton icon="close" label={t('menu.cancel')} onPress={onClose} />
        </View>
        <View style={{ height: 90, borderRadius: radius.lg, backgroundColor: preview, borderWidth: 1, borderColor: c.line }} accessible accessibilityLabel={t('colour.preview', { color: preview })} />
        <ColourStrip label={t('colour.hue')} value={hsv.h / 360} onChange={(h) => adjust({ h: h * 360 })} stops={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']} />
        <ColourStrip label={t('colour.saturation')} value={hsv.s} onChange={(s) => adjust({ s })} stops={[hsvToHex({ ...hsv, s: 0 }), hsvToHex({ ...hsv, s: 1 })]} />
        <ColourStrip label={t('colour.brightness')} value={hsv.v} onChange={(v) => adjust({ v })} stops={['#000000', hsvToHex({ ...hsv, v: 1 })]} />
        <View style={{ gap: space.sm }}>
          <Text style={[ty.bodyBold, { color: c.ink }]}>{t('colour.hex')}</Text>
          <TextInput testID="colour-hex" value={draft} accessibilityLabel={t('colour.hex')} autoCorrect={false} autoCapitalize="characters" maxLength={7} selectTextOnFocus returnKeyType="done"
            onChangeText={(value) => { setDraft(value); const hex = normalizeHex(value); if (hex) setHsv(hexToHsv(hex)); }}
            style={[ty.body, { minHeight: 48, padding: space.md, borderRadius: radius.sm, borderWidth: 1, borderColor: valid ? c.line : c.accent, backgroundColor: c.card, color: c.ink }]} />
          <Text style={[ty.small, { color: c.ink2 }]}>{t('colour.hexHint')}</Text>
        </View>
        <Button label={t('colour.use')} disabled={!valid} onPress={() => { if (valid) onChoose(valid); }} />
        <Button label={t('menu.cancel')} kind="soft" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}
