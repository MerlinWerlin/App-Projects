// T72: Settings > Licences and credits. Every data source, font, icon set and library Satchel uses, with its licence,
// the attribution line it asks for (OpenStreetMap ODbL, MET Norway CC BY 4.0), and a link to read the licence.
// The rows are src/core/licences.ts, checked against docs/THIRD_PARTY.md and package.json by its test. Offline;
// a link opens the browser only when tapped.
// T76: each row gets a short plain-words summary of its licence, and the fonts section is followed by the SIL Open
// Font License 1.1 notice for the bundled fonts (copyright lines, and the full licence text behind a button).
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { BUNDLED_FONTS, isOflHeading, OFL_1_1 } from '../src/core/fontlicence.ts';
import { LICENCE_SECTIONS, summaryKey, type LicenceEntry } from '../src/core/licences.ts';
import type { Key } from '../src/i18n/en.ts';
import { useApp } from '../src/state/app.tsx';
import { fonts, space, typeScale } from '../src/theme/tokens.ts';
import { Body, Button, Card, Label, Screen } from '../src/ui/kit.tsx';

function Entry({ e, first, onFailed }: { e: LicenceEntry; first: boolean; onFailed: (url: string) => void }) {
  const { t, theme } = useApp();
  const summary = summaryKey(e);
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
      {summary ? <Text style={[typeScale.small, { color: theme.muted }]}>{t(summary as Key)}</Text> : null}
      {e.url ? (
        <Button label={t('licences.read', { name: e.name })} hint={t('licences.linkHint')} kind="quiet" icon="open-outline" onPress={() => open(e.url as string)} />
      ) : null}
    </View>
  );
}

/** The OFL notice the bundled fonts need: who holds the copyright, then the licence itself on request. */
function FontNotice() {
  const { t, theme } = useApp();
  const [full, setFull] = useState(false);
  return (
    <View style={{ gap: space.s }}>
      <View accessibilityRole="header">
        <Label>{t('f88.licences.oflTitle')}</Label>
      </View>
      <Card>
        <Body muted>{t('f88.licences.oflIntro')}</Body>
        {BUNDLED_FONTS.map((f) => (
          <View key={f.family} accessible style={{ gap: 2 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('f88.licences.oflFont', { family: f.family, weights: f.weights.join(', ') })}</Text>
            <Text selectable style={[typeScale.small, { color: theme.muted }]}>
              {f.copyright}
            </Text>
          </View>
        ))}
        <Button
          label={t(full ? 'f88.licences.oflHide' : 'f88.licences.oflShow')}
          hint={t('f88.licences.oflShowHint')}
          kind="quiet"
          icon={full ? 'chevron-up' : 'document-text-outline'}
          onPress={() => setFull((v) => !v)}
        />
        {full ? (
          <View style={{ gap: space.s }}>
            {OFL_1_1.map((p, i) =>
              isOflHeading(p) ? (
                <Text key={i} accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.ink }}>
                  {p}
                </Text>
              ) : (
                <Text key={i} selectable style={[typeScale.small, { color: theme.ink }]}>
                  {p}
                </Text>
              ),
            )}
          </View>
        ) : null}
      </Card>
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
          {s.id === 'fonts' ? <FontNotice /> : null}
        </View>
      ))}
      <Body muted>{t('f88.licences.summaryNote')}</Body>
      <Body muted>{t('licences.footnote')}</Body>
    </Screen>
  );
}
