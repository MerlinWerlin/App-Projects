import { useRef, useState } from 'react';
import { Platform, ScrollView, TextInput } from 'react-native';
import { Redirect } from 'expo-router';
import { t } from '../src/i18n';
import { useApp } from '../src/state/AppState';
import { Btn, Txt } from '../src/ui/kit';
import { FONT } from '../src/theme/theme';

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
  return <ScrollView style={{ backgroundColor: app.theme.bg }} contentContainerStyle={{ padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
    <Txt v="title">{t(app.codeAccess ? 'access.active' : 'access.title')}</Txt>
    <Txt tone="sub">{t(app.codeAccess ? 'access.activeBody' : 'access.body')}</Txt>
    {!app.codeAccess ? <TextInput
      testID="access-code-input"
      accessibilityLabel={t('access.title')} placeholder={t('access.title')}
      placeholderTextColor={app.theme.sub} value={code} onChangeText={(value) => { setCode(value); setError(false); }}
      autoCapitalize="characters" autoCorrect={false} maxLength={128} editable={!busy}
      secureTextEntry
      style={{ color: app.theme.ink, backgroundColor: app.theme.card, borderColor: app.theme.line, borderWidth: 1, borderRadius: 12, padding: 16, fontFamily: FONT.body, fontSize: 17 }}
    /> : null}
    {error ? <Txt tone="danger" accessibilityLiveRegion="polite">{t('access.failed')}</Txt> : null}
    <Btn label={t(app.codeAccess ? 'access.remove' : 'access.redeem')} onPress={() => { void act(); }} disabled={busy || (!app.codeAccess && !code.trim())} />
  </ScrollView>;
}
