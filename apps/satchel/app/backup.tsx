// T17 Settings > Backup: Back up now (one .satchelbackup file through the share sheet: Save to Files, iCloud Drive,
// AirDrop), the "Include documents" switch (off by default, with a plain warning when on), the last backup date, and
// Restore from a file with a preview (date, app version, counts) then Merge or Replace (Replace asks first).
// After a restore the app starts again so every screen reads the restored data. Format: docs/BACKUP.md.
import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Text, View } from 'react-native';
import { backupPreview, LARGE_BACKUP_BYTES, parseBackup, planRestore, type Backup, type BackupFailure, type RestoreMode } from '../src/core/backup.ts';
import { formatSize } from '../src/core/citymaps.ts';
import { deviceZone, formatDay, todayIn } from '../src/core/format.ts';
import { applyRestore, currentStore, estimateBackup, makeBackup, pickBackup, readBackupText, restartApp, shareBackup } from '../src/native/backup.ts';
import { haptic } from '../src/native/device.ts';
import { documentDir } from '../src/native/files.ts';
import { useApp } from '../src/state/app.tsx';
import { useBackupState } from '../src/state/backup.ts';
import { fonts, space } from '../src/theme/tokens.ts';
import { ErrorNotice } from '../src/ui/ErrorNotice.tsx';
import { FadeInView, HeroHeader, SectionHeader, type IconName, type Tone } from '../src/ui/hero.tsx';
import { Body, Button, Card, Label, Screen, ToggleRow, Warning } from '../src/ui/kit.tsx';

type MakeState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; uri: string; trips: number; files: number; bytes: number; skipped: number; shareFailed?: boolean }
  | { kind: 'error' };
type RestoreFailure = BackupFailure | 'too-large' | 'unreadable' | 'picker' | 'save';
type RestoreState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'preview'; backup: Backup }
  | { kind: 'applying' }
  | { kind: 'done'; restarted: boolean }
  | { kind: 'error'; reason: RestoreFailure };

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';

function Section({ title, icon, tone, children }: { title: string; icon: IconName; tone: Tone; children: ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <SectionHeader title={title} icon={icon} tone={tone} />
      <Card style={{ gap: space.m }}>{children}</Card>
    </View>
  );
}

const dayOf = (iso: string, lang: string) => formatDay(todayIn(deviceZone(), Date.parse(iso)), lang);

export default function BackupScreen() {
  const { t, theme, lang } = useApp();
  const [state, update] = useBackupState();
  const [make, setMake] = useState<MakeState>({ kind: 'idle' });
  const [restore, setRestore] = useState<RestoreState>({ kind: 'idle' });

  const share = async (uri: string) => {
    const r = await shareBackup(uri, t('backup.make.shareTitle'));
    return r === 'shared';
  };

  const runBackup = async () => {
    setMake({ kind: 'busy' });
    AccessibilityInfo.announceForAccessibility(t('backup.make.busy'));
    const r = await makeBackup({ includeDocuments: state.includeDocuments, app: APP_VERSION, now: new Date() });
    if (!r.ok) {
      setMake({ kind: 'error' });
      return;
    }
    update((s) => ({ ...s, lastAt: new Date().toISOString() }));
    const shared = await share(r.uri);
    if (shared) haptic.success();
    setMake({ kind: 'done', uri: r.uri, trips: r.counts.trips, files: r.counts.files, bytes: r.counts.bytes, skipped: r.skipped, shareFailed: !shared });
  };

  const backUpNow = async () => {
    if (make.kind === 'busy') return;
    const est = await estimateBackup(state.includeDocuments);
    if (est.bytes > LARGE_BACKUP_BYTES) {
      Alert.alert(t('backup.large.title'), t('backup.large.body', { size: formatSize(est.bytes) }), [
        { text: t('backup.cancel'), style: 'cancel' },
        { text: t('backup.large.go'), onPress: () => void runBackup() },
      ]);
      return;
    }
    await runBackup();
  };

  const chooseFile = async () => {
    if (restore.kind === 'busy' || restore.kind === 'applying') return;
    const picked = await pickBackup();
    if (!picked.ok) {
      setRestore(picked.reason === 'cancelled' ? { kind: 'idle' } : { kind: 'error', reason: 'picker' });
      return;
    }
    setRestore({ kind: 'busy' });
    AccessibilityInfo.announceForAccessibility(t('backup.restore.busy'));
    const read = await readBackupText(picked.uri, picked.size);
    if (!read.ok) {
      setRestore({ kind: 'error', reason: read.reason });
      return;
    }
    const parsed = parseBackup(read.text);
    setRestore(parsed.ok ? { kind: 'preview', backup: parsed.backup } : { kind: 'error', reason: parsed.reason });
  };

  const apply = async (b: Backup, mode: RestoreMode) => {
    setRestore({ kind: 'applying' });
    AccessibilityInfo.announceForAccessibility(t('backup.restore.applying'));
    let before: Record<string, string>;
    try {
      before = await currentStore();
    } catch {
      setRestore({ kind: 'error', reason: 'save' });
      return;
    }
    const r = await applyRestore(planRestore(b, before, mode, documentDir()), before);
    if (!r.ok) {
      setRestore({ kind: 'error', reason: 'save' });
      return;
    }
    haptic.success();
    AccessibilityInfo.announceForAccessibility(t('backup.restore.done'));
    setRestore({ kind: 'done', restarted: true });
    const restarted = await restartApp();
    if (!restarted) setRestore({ kind: 'done', restarted: false });
  };

  const confirmReplace = (b: Backup) =>
    Alert.alert(t('backup.replace.confirmTitle'), t('backup.replace.confirmBody'), [
      { text: t('backup.cancel'), style: 'cancel' },
      { text: t('backup.replace.confirm'), style: 'destructive', onPress: () => void apply(b, 'replace') },
    ]);

  const failure = restore.kind === 'error' ? restore.reason : null;
  const preview = restore.kind === 'preview' ? backupPreview(restore.backup) : null;

  return (
    <Screen>
      <FadeInView>
        <HeroHeader tone="trips" illustration="route" compact eyebrow={t('backup.heroEyebrow')} title={t('backup.heroTitle')} subtitle={t('backup.heroSubtitle')} />
      </FadeInView>

      <Section title={t('backup.make.title')} icon="cloud-upload-outline" tone="sea">
        <Body>{t('backup.make.body')}</Body>
        <View accessible accessibilityLiveRegion="polite">
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
            {state.lastAt ? t('backup.last', { date: dayOf(state.lastAt, lang) }) : t('backup.lastNone')}
          </Text>
        </View>
        {state.lastAt ? <Body muted>{t('backup.lastNote')}</Body> : null}
        <ToggleRow label={t('backup.docs.toggle')} hint={t('backup.docs.toggleHint')} value={state.includeDocuments} onChange={(v) => update((s) => ({ ...s, includeDocuments: v }))} />
        {state.includeDocuments ? <Warning text={t('backup.docs.warning')} /> : <Body muted>{t('backup.docs.off')}</Body>}
        {make.kind === 'busy' ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t('backup.make.busy')}>
            <Label>{t('backup.make.busy')}</Label>
          </View>
        ) : (
          <Button label={t('backup.make.button')} hint={t('backup.make.buttonHint')} icon="cloud-upload-outline" onPress={() => void backUpNow()} />
        )}
        {make.kind === 'done' ? (
          <FadeInView style={{ gap: space.s }}>
            <Body>{t('backup.make.done', { trips: make.trips, files: make.files, size: formatSize(make.bytes) })}</Body>
            {make.skipped ? <Body muted>{t('backup.make.skipped', { n: make.skipped })}</Body> : null}
            {make.shareFailed ? <Body muted>{t('backup.error.share')}</Body> : null}
            <Button label={t('backup.make.again')} hint={t('backup.make.againHint')} kind="quiet" icon="share-outline" onPress={() => void share(make.uri)} />
          </FadeInView>
        ) : null}
        {make.kind === 'error' ? (
          <ErrorNotice title={t('backup.error.make.title')} body={t('backup.error.make.body')} action={t('backup.tryAgain')} actionHint={t('backup.make.buttonHint')} onAction={() => void backUpNow()} />
        ) : null}
      </Section>

      <Section title={t('backup.restore.title')} icon="cloud-download-outline" tone="teal">
        <Body>{t('backup.restore.body')}</Body>
        {restore.kind === 'busy' || restore.kind === 'applying' ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t(restore.kind === 'busy' ? 'backup.restore.busy' : 'backup.restore.applying')}>
            <Label>{t(restore.kind === 'busy' ? 'backup.restore.busy' : 'backup.restore.applying')}</Label>
          </View>
        ) : restore.kind === 'done' ? (
          <View accessible accessibilityLiveRegion="polite">
            <Body>{restore.restarted ? t('backup.restore.done') : t('backup.restore.reopen')}</Body>
          </View>
        ) : restore.kind !== 'preview' ? (
          <Button label={t('backup.restore.button')} hint={t('backup.restore.buttonHint')} kind="secondary" icon="folder-open-outline" onPress={() => void chooseFile()} />
        ) : null}

        {restore.kind === 'preview' && preview ? (
          <FadeInView style={{ gap: space.m }}>
            <View accessible accessibilityRole="header">
              <Text style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>{t('backup.preview.title')}</Text>
            </View>
            <Body>{t('backup.preview.made', { date: dayOf(preview.created, lang), version: preview.app || '?' })}</Body>
            <Body>{t('backup.preview.counts', { trips: preview.trips, items: preview.items, files: preview.files, size: formatSize(preview.bytes) })}</Body>
            <Body muted>{preview.includesDocuments ? t('backup.preview.docs', { n: preview.documents }) : t('backup.preview.noDocs')}</Body>
            <Body muted>{t('backup.mergeBody')}</Body>
            <Button label={t('backup.merge')} hint={t('backup.mergeHint')} icon="git-merge-outline" onPress={() => void apply(restore.backup, 'merge')} />
            <Body muted>{t('backup.replaceBody')}</Body>
            <Button label={t('backup.replace')} hint={t('backup.replaceHint')} kind="quiet" icon="swap-horizontal-outline" onPress={() => confirmReplace(restore.backup)} />
            <Button label={t('backup.restore.cancel')} hint={t('backup.restore.cancelHint')} kind="quiet" onPress={() => setRestore({ kind: 'idle' })} />
          </FadeInView>
        ) : null}

        {failure === 'not-backup' ? <ErrorNotice title={t('backup.error.notBackup.title')} body={t('backup.error.notBackup.body')} /> : null}
        {failure === 'newer' ? <ErrorNotice title={t('backup.error.newer.title')} body={t('backup.error.newer.body')} /> : null}
        {failure === 'damaged' ? <ErrorNotice title={t('backup.error.damaged.title')} body={t('backup.error.damaged.body')} /> : null}
        {failure === 'too-large' ? <ErrorNotice title={t('backup.error.tooLarge.title')} body={t('backup.error.tooLarge.body')} /> : null}
        {failure === 'unreadable' ? <ErrorNotice title={t('backup.error.unreadable.title')} body={t('backup.error.unreadable.body')} /> : null}
        {failure === 'picker' ? <ErrorNotice title={t('backup.error.unreadable.title')} body={t('backup.error.picker')} /> : null}
        {failure === 'save' ? (
          <ErrorNotice title={t('backup.error.save.title')} body={t('backup.error.save.body')} action={t('backup.tryAgain')} actionHint={t('backup.restore.buttonHint')} onAction={() => void chooseFile()} />
        ) : null}
      </Section>

      <Section title={t('backup.later.title')} icon="sync-outline" tone="accent">
        <Body muted>{t('backup.later.body')}</Body>
      </Section>
    </Screen>
  );
}
