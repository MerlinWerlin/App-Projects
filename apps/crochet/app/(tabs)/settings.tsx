// Settings: terms, counting, look, backup, Plus, about.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fromBackup, toBackup } from '../../src/core/model';
import { t } from '../../src/i18n';
import { isDevBuild, resetPlus, restorePlus, usePlus } from '../../src/plus/entitlement';
import { flush, importData, snapshot } from '../../src/store/data';
import { pickBackupText, shareText } from '../../src/store/files';
import { setSettings, useSettings } from '../../src/store/settings';
import { space } from '../../src/theme/tokens';
import { Body, Group, Row, ScreenScroll, Section, Segmented, SwitchRow, Title } from '../../src/ui/kit';
import { LanguageSheet, currentLanguageLabel } from '../../src/ui/LanguageSheet';
import { useToast } from '../../src/ui/Toast';

export default function SettingsScreen() {
  const s = useSettings();
  const plus = usePlus();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [langOpen, setLangOpen] = useState(false);

  const exportBackup = async () => {
    await flush();
    const day = new Date().toISOString().slice(0, 10);
    const r = await shareText(`rowlight-backup-${day}.json`, toBackup(snapshot()));
    if (!r.ok && r.reason !== 'cancelled') toast(r.message);
  };

  const importBackup = async () => {
    const r = await pickBackupText();
    if (!r.ok) {
      if (r.reason !== 'cancelled') toast(r.message);
      return;
    }
    const d = fromBackup(r.value);
    if (!d) {
      toast(t('backup.notBackup'));
      return;
    }
    Alert.alert(t('backup.importTitle'), t('backup.importBody', { projects: d.projects.length, yarns: d.yarns.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.merge'),
        onPress: () => {
          importData(d, 'merge');
          toast(t('backup.done'));
        },
      },
      {
        text: t('backup.replace'),
        style: 'destructive',
        onPress: () => {
          importData(d, 'replace');
          toast(t('backup.done'));
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.s }}>
      <ScreenScroll>
        <Title>{t('settings.title')}</Title>

        <Section title={t('settings.language')}>
          <Group>
            <Row icon="globe" title={t('settings.language')} subtitle={currentLanguageLabel(s.language)} onPress={() => setLangOpen(true)} last />
          </Group>
        </Section>

        <Section title={t('settings.terms')}>
          <Segmented
            options={[
              { value: 'US', label: t('terms.us') },
              { value: 'UK', label: t('terms.uk') },
            ]}
            value={s.terms}
            onChange={(v) => setSettings({ terms: v })}
          />
          <Body small muted style={{ paddingHorizontal: 4 }}>
            {t('settings.termsHelp')}
          </Body>
        </Section>

        <Section title={t('settings.counting')}>
          <Group>
            <SwitchRow icon="sun" title={t('settings.keepAwake')} subtitle={t('settings.keepAwakeHelp')} value={s.keepAwake} onChange={(v) => setSettings({ keepAwake: v })} />
            <SwitchRow icon="volume-2" title={t('settings.speak')} subtitle={t('settings.speakHelp')} value={s.speakCount} onChange={(v) => setSettings({ speakCount: v })} />
            <SwitchRow icon="smartphone" title={t('settings.haptics')} value={s.haptics} onChange={(v) => setSettings({ haptics: v })} />
            <SwitchRow icon="corner-down-left" title={t('settings.leftHanded')} subtitle={t('settings.leftHandedHelp')} value={s.leftHanded} onChange={(v) => setSettings({ leftHanded: v })} last />
          </Group>
        </Section>

        <Section title={t('settings.look')}>
          <Segmented
            options={[
              { value: 'system', label: t('settings.system') },
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
            ]}
            value={s.appearance}
            onChange={(v) => setSettings({ appearance: v })}
          />
          <Group>
            <SwitchRow icon="wind" title={t('settings.reduceMotion')} value={s.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} />
            <Row
              icon="maximize"
              title={t('settings.units')}
              subtitle={s.units === 'cm' ? t('settings.unitsCm') : t('settings.unitsIn')}
              onPress={() => setSettings({ units: s.units === 'cm' ? 'in' : 'cm' })}
              last
            />
          </Group>
        </Section>

        <Section title={t('settings.backup')}>
          <Group>
            <Row icon="upload" title={t('backup.export')} subtitle={t('backup.exportHelp')} onPress={() => exportBackup().catch(() => {})} />
            <Row icon="download" title={t('backup.import')} subtitle={t('backup.importHelp')} onPress={() => importBackup().catch(() => {})} last />
          </Group>
        </Section>

        <Section title={t('plus.name')}>
          <Group>
            {plus ? (
              <Row icon="star" title={t('plus.active')} subtitle={t('plus.thanks')} chevron={false} />
            ) : (
              <Row icon="star" title={t('plus.unlock')} subtitle={t('plus.short')} onPress={() => router.push('/plus')} />
            )}
            <Row
              icon="refresh-cw"
              title={t('plus.restore')}
              onPress={() => restorePlus().then((v) => toast(v ? t('plus.restored') : t('plus.nothingToRestore')))}
              last={!isDevBuild || !plus}
            />
            {isDevBuild && plus ? <Row icon="x-circle" title={t('plus.devReset')} onPress={() => resetPlus().catch(() => {})} last /> : null}
          </Group>
        </Section>

        <Section title={t('settings.about')}>
          <Group>
            <Row icon="shield" title={t('settings.privacy')} subtitle={t('settings.privacyHelp')} chevron={false} />
            <Row icon="info" title={t('settings.version')} subtitle={`${Constants.expoConfig?.version ?? '0.1.0'}`} chevron={false} last />
          </Group>
        </Section>
      </ScreenScroll>
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </View>
  );
}
