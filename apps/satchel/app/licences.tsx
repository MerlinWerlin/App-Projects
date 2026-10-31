// T72: Settings > Licences and credits. Every data source, font, icon set and library Satchel uses, with its licence,
// the attribution line it asks for (OpenStreetMap ODbL, MET Norway CC BY 4.0), and a link to read the licence.
// The rows are src/core/licences.ts, checked against docs/THIRD_PARTY.md and package.json by its test. Offline;
// a link opens the browser only when tapped.
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { LICENCE_SECTIONS, type LicenceEntry } from '../src/core/licences.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { fonts, space, typeScale } from '../src/theme/tokens.ts';
import { Body, Button, Card, Label, Screen } from '../src/ui/kit.tsx';

function Entry({ e, first, onFailed }: { e: LicenceEntry; first: boolean; onFailed: (url: string) => void }) {
  const { t, theme } = useApp();
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      onFailed(url);
    }
  };
  return (
    <View style={{ gap: space.xs, paddingTop: first ? 0 : space.m, borderTopWidth: first ? 0 : 1, borderTopColor: theme.line }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{e.name}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('licences.licence', { licence: e.licence })}</Text>
      {e.credit ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink }}>{t(e.credit as Key)}</Text> : null}
      {e.what ? <Body muted>{t(e.what as Key)}</Body> : null}
      {e.url ? (
        <Button label={t('licences.read', { name: e.name })} hint={t('licences.linkHint')} kind="quiet" icon="open-outline" onPress={() => open(e.url as string)} />
      ) : null}
    </View>
  );
}

export default function LicencesScreen() {
  const { t, theme } = useApp();
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <Screen>
      <Body>{t('licences.intro')}</Body>
      {failed ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {t('licences.linkFailed', { url: failed })}
        </Text>
      ) : null}
      {LICENCE_SECTIONS.map((s) => (
        <View key={s.id} style={{ gap: space.s }}>
          <View accessibilityRole="header">
            <Label>{t(s.title as Key)}</Label>
          </View>
          <Card>
            {s.entries.map((e, i) => (
              <Entry key={e.id} e={e} first={i === 0} onFailed={setFailed} />
            ))}
          </Card>
        </View>
      ))}
      <Body muted>{t('licences.footnote')}</Body>
    </Screen>
  );
}
