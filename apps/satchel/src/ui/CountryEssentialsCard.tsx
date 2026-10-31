// T55 country essentials card for the Emergency tab: plug types (IEC A–N), voltage, frequency, driving side and the
// international calling code for the chosen country, from the bundled src/content/country_essentials.json. An
// unknown value says "Not sure — check locally", never a blank. "Bring an adapter?" compares plugs and voltage with
// the home country the traveller sets here (saved on this phone via usePersisted, HOME_COUNTRY_KEY). Tokens only,
// light and dark; 48 pt targets; every control labelled; the hint fades in on a timed tween (no springs).
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import emergencyTable from '../content/emergency_numbers.json';
import essentialsTable from '../content/country_essentials.json';
import { searchCountries, type EmergencyTable } from '../core/emergency.ts';
import { adapterHint, displayEssentials, findEssentials, HOME_COUNTRY_KEY, normaliseHome, type EssentialsTable } from '../core/essentials.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { fonts, radius, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge, SectionCard, type IconName } from './hero.tsx';
import { Body, Button, PressableScale, TextField } from './kit.tsx';

const TABLE = essentialsTable as EssentialsTable;
const COUNTRIES = emergencyTable as EmergencyTable;
const NO_HOME: string | null = null;
const MAX_LIST = 30;

function FactRow({ icon, label, value }: { icon: IconName; label: string; value: string | null }) {
  const { t, theme } = useApp();
  const shown = value ?? t('essentials.notSure');
  return (
    <View
      accessible
      accessibilityLabel={t('essentials.rowA11y', { label, value: shown })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44 }}
    >
      <IconBadge name={icon} tone={value ? 'sea' : 'warn'} size="s" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typeScale.small, { color: theme.muted }]}>{label}</Text>
        <Text style={[value ? typeScale.bodyStrong : typeScale.body, { color: value ? theme.ink : theme.warn }]}>{shown}</Text>
      </View>
    </View>
  );
}

export function CountryEssentialsCard({ iso2 }: { iso2: string }) {
  const { t, theme } = useApp();
  const [storedHome, setHome] = usePersisted<string | null>(HOME_COUNTRY_KEY, NO_HOME);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(COUNTRIES, query), [query]);

  const row = findEssentials(TABLE, iso2);
  if (!row) return null;
  const d = displayEssentials(row);
  const homeIso = normaliseHome(TABLE, storedHome);
  const homeRow = findEssentials(TABLE, homeIso);
  const hint = homeRow ? adapterHint(row, homeRow) : null;
  const homePlugs = homeRow?.plugs?.join(', ') ?? '';

  const driving = d.driving === 'left' ? t('essentials.drivingLeft') : d.driving === 'right' ? t('essentials.drivingRight') : null;
  const sources = d.sourceHosts.join(', ');

  const choose = (code: string | null) => {
    setHome(code);
    setListOpen(false);
    setQuery('');
  };

  let verdict = '';
  if (hint && homeRow) {
    if (hint.verdict === 'same') verdict = t('essentials.adapter.same', { country: d.country });
    else if (hint.verdict === 'fits') verdict = t('essentials.adapter.fits', { home: homeRow.country, plugs: homePlugs });
    else if (hint.verdict === 'some') verdict = t('essentials.adapter.some', { home: homeRow.country, fitting: hint.fitting.join(', ') });
    else if (hint.verdict === 'adapter') verdict = t('essentials.adapter.adapter', { home: homeRow.country, plugs: homePlugs, dest: d.plugs ?? '' });
    else verdict = t('essentials.adapter.unknown');
  }

  return (
    <SectionCard icon="flash-outline" tone="teal" title={t('essentials.cardTitle')} subtitle={t('essentials.subtitle', { country: d.country })}>
      <View style={{ gap: space.s }}>
        <FactRow icon="power-outline" label={t('essentials.plugs')} value={d.plugs ? t('essentials.plugsValue', { list: d.plugs }) : null} />
        <FactRow icon="flash-outline" label={t('essentials.voltage')} value={d.voltage} />
        <FactRow icon="pulse-outline" label={t('essentials.frequency')} value={d.frequency} />
        <FactRow icon="car-outline" label={t('essentials.driving')} value={driving} />
        <FactRow icon="call-outline" label={t('essentials.callingCode')} value={d.callingCode} />
      </View>

      {d.notes ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('essentials.note', { note: d.notes })}</Text> : null}

      <View
        style={{
          gap: space.s,
          padding: space.m,
          borderRadius: radius.m,
          backgroundColor: theme.tealSoft,
        }}
      >
        <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
          {t('essentials.adapterHeading')}
        </Text>
        {hint && homeRow ? (
          <FadeInView key={`${homeRow.iso2}-${row.iso2}`} style={{ gap: space.xs }}>
            <Text style={[typeScale.body, { color: theme.ink }]}>{verdict}</Text>
            {hint.voltageDiffers ? <Text style={[typeScale.body, { color: theme.ink }]}>{t('essentials.voltageDiffers', { home: homeRow.country })}</Text> : null}
            <Text style={[typeScale.small, { color: theme.muted }]}>{t('essentials.homeLabel', { country: homeRow.country })}</Text>
          </FadeInView>
        ) : (
          <Text style={[typeScale.body, { color: theme.ink }]}>{t('essentials.homeNone')}</Text>
        )}
        <Button
          kind="quiet"
          label={listOpen ? t('essentials.homeDone') : homeRow ? t('essentials.homeChange') : t('essentials.homeSet')}
          hint={listOpen ? undefined : homeRow ? t('essentials.homeChangeHint') : t('essentials.homeSetHint')}
          onPress={() => setListOpen(!listOpen)}
        />
      </View>

      {listOpen ? (
        <View style={{ gap: space.s }}>
          <TextField label={t('essentials.homeSearch')} value={query} onChange={setQuery} placeholder={t('essentials.homeSearchPlaceholder')} autoCapitalize="none" />
          {homeRow ? <Button kind="quiet" label={t('essentials.homeClear')} hint={t('essentials.homeClearHint')} onPress={() => choose(null)} /> : null}
          {results.length === 0 ? <Body muted>{t('essentials.homeNoMatch', { q: query.trim() })}</Body> : null}
          {results.slice(0, MAX_LIST).map((r) => {
            const selected = r.iso2 === homeIso;
            return (
              <PressableScale
                key={r.iso2}
                accessibilityRole="radio"
                accessibilityLabel={t('essentials.homePick', { country: r.country })}
                accessibilityHint={t('essentials.homePickHint', { country: r.country })}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => choose(r.iso2)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: space.l,
                  borderRadius: radius.m,
                  borderWidth: 1,
                  borderColor: selected ? theme.accent : theme.line,
                  backgroundColor: selected ? theme.accentSoft : theme.card,
                }}
              >
                <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{r.country}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{r.iso2}</Text>
              </PressableScale>
            );
          })}
          {results.length > MAX_LIST ? <Body muted>{t('essentials.homeMore', { n: MAX_LIST, total: results.length })}</Body> : null}
        </View>
      ) : null}

      <Text style={[typeScale.small, { color: theme.muted }]}>{t('essentials.verifyLocally')}</Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>
        {d.checked ? t('essentials.sources', { hosts: sources, date: d.checked }) : t('essentials.sourcesNoDate', { hosts: sources })}
      </Text>
    </SectionCard>
  );
}
