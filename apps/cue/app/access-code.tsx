import { useRef, useState } from 'react';
import { Platform, ScrollView, TextInput } from 'react-native';
import { Redirect } from 'expo-router';
import { t } from '../src/i18n';
import { useApp } from '../src/state/AppState';
import { Btn, Txt } from '../src/ui/kit';
import { RADIUS, SPACE, TYPE } from '../src/theme/theme';

export default function AccessCode() {
  const app = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState(false);
  if (Platform.OS !== 'android') return <Redirect href="/settings" />;
  const act = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const ok = app.codeAccess ? await app.removeAccessCode() : await app.redeemAccessCode(code);
      setError(!ok);
      if (ok) setCode('');
    } finally { working.current = false; setBusy(false); }
  };
  return <ScrollView style={{ backgroundColor: app.theme.ground }} contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md }} keyboardShouldPersistTaps="handled">
    <Txt v="headline">{t(app.codeAccess ? 'access.active' : 'access.title')}</Txt>
    <Txt tone="ink2">{t(app.codeAccess ? 'access.activeBody' : 'access.body')}</Txt>
    {!app.codeAccess ? <TextInput
      testID="access-code-input"
      accessibilityLabel={t('access.title')} placeholder={t('access.title')}
      placeholderTextColor={app.theme.ink3} selectionColor={app.theme.go} value={code} onChangeText={(value) => { setCode(value); setError(false); }}
      autoCapitalize="characters" autoCorrect={false} maxLength={128} editable={!busy}
      secureTextEntry
      style={[TYPE.body, { color: app.theme.ink, backgroundColor: app.theme.field, borderRadius: RADIUS.field, padding: SPACE.md }]}
    /> : null}
    {error ? <Txt tone="danger" accessibilityLiveRegion="polite">{t('access.failed')}</Txt> : null}
    <Btn label={t(app.codeAccess ? 'access.remove' : 'access.redeem')} onPress={() => { void act(); }} disabled={busy || (!app.codeAccess && !code.trim())} />
  </ScrollView>;
}
