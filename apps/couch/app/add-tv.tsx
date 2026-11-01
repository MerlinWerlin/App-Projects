import { useRouter } from 'expo-router';
import { useEffect, useReducer, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ADD_TV_IR_ROUTE,
  addTvReducer,
  androidTvPairingDriver,
  createAddTvState,
  demoScan,
  finishAddTv,
  foundLabel,
  irSetupOffered,
  isCodeComplete,
  routeFor,
  startAndroidTvPairing,
  submitAndroidTvCode,
  type AddCandidate,
  type AddTvState,
} from '../src/core/addTv';
import type { AndroidTvDriver } from '../src/core/drivers/androidtv/driver';
import { discoverTvs } from '../src/core/discoveryService';
import { candidateNotice, lostRemoteHelp, platformList, type PairingNotice } from '../src/core/pairingNotice';
import { probeHost } from '../src/core/probe';
import { BETA_PLATFORMS, PLATFORM_LABEL } from '../src/core/types';
import { LOCALES } from '../src/i18n/locales';
import { useLocale, useT } from '../src/i18n/react';
import { useSession } from '../src/state/session';
import { addTv, savedTvStore } from '../src/state/tvs';
import { appDiscoveryDeps } from '../src/native/discoveryDeps';
import { appTransport, fetchAdapter } from '../src/native/transport';
import { hasUdp } from '../src/native/udp';
import { list, space, textStyle } from '../src/theme/design';
import { useTheme } from '../src/theme/useTheme';
import { Callout, StepField, StepText, StepTitle } from '../src/ui/addTv/parts';
import { DemoNote } from '../src/ui/Screen';
import { Sheet } from '../src/ui/Sheet';
import { Text } from '../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

/**
 * Add a TV, design v2 (market-1018 M3, docs/DESIGN_V2.md): "Add a TV" large title with a Cancel pill;
 * found TVs are inset-grouped rows (name, address, platform + chevron); infrared and "enter its
 * address" are a separate group; what the TV will ask for is a Card before pairing; the primary action
 * of each step is a full-width filled pill.
 * Flow (prototype v2 sheet): scan first -> pick -> pair (per platform) -> name ("TV n") + room ->
 * saved. Logic lives in src/core/addTv.ts (pure reducer, unit-tested); this screen only renders it and
 * runs effects. Demo mode uses a fake scan (MockTv). Typing an address is a last-resort link; the
 * "Older TV, or not on Wi-Fi?" row goes to the infrared setup screen. Expo Go has no UDP/mDNS, so a
 * real scan there may find nothing; the address link is then the way in.
 * Transport comes from appTransport(): fetch always, a WebSocket factory only in dev builds that
 * include the lan-wss module (Samsung needs it, else it shows as coming soon). Sony Bravia asks for the
 * Pre-Shared Key set on the TV; a wrong key brings the user back to that step with the error.
 * Lost remote (T71): before pairing a TV that asks for something on screen, a card says what it will
 * ask (src/core/pairingNotice.ts); "Lost your remote?" opens a sheet with what works without it.
 * Google TV: with the native remote socket the pair step asks the TV to show its code and checks it
 * (the paired driver goes to finishAddTv); without it the "coming soon" step offers "Use for casting
 * photos and videos", which saves the TV cast-only and ends on "Go to Cast".
 */
export default function AddTvScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { session, snap } = useSession();
  const [transport] = useState(appTransport);
  const [s, dispatch] = useReducer(addTvReducer, null, () =>
    createAddTvState({ takenNames: snap.tvs.map((tv) => tv.name), transport }),
  );
  const alive = useRef<boolean>(true);
  const demo = snap.demo;
  const [lostOpen, setLostOpen] = useState(false);
  // One-line scan report under "No TVs found" (owner 1 Nov 2026: TCL Google TV not found; shows what the scan saw).
  const [report, setReport] = useState<string | null>(null);
  // Google TV pairing (real TVs only): the driver that shows the code on the TV, and its phase.
  const atvRef = useRef<AndroidTvDriver | null>(null);
  const [atvPhase, setAtvPhase] = useState<'starting' | 'ready' | 'failed'>('starting');
  const [atvRun, setAtvRun] = useState(0);
  const [atvBusy, setAtvBusy] = useState(false);
  const lostLink = (
    <PillButton variant="plain" label={t('app.addTv.lostRemote')} accessibilityLabel={t('app.addTv.lostRemote')} onPress={() => setLostOpen(true)} />
  );
  const openIrFromSheet = (): void => {
    setLostOpen(false);
    // The reducer only routes to infrared from the list: leave a pair step first.
    if (s.step === 'pair' || s.step === 'manual') dispatch({ type: 'back' });
    dispatch({ type: 'ir' });
  };

  // Saved TV names feed the "TV n" default name.
  useEffect(() => {
    savedTvStore
      .list()
      .then((tvs) => {
        if (alive.current) dispatch({ type: 'takenNames', names: tvs.map((tv) => tv.name) });
      })
      .catch(() => {
        // Defaults then only consider the TVs in this session.
      });
  }, []);

  // "Older TV, or not on Wi-Fi?": open the infrared setup screen, and come back to the list.
  const goIr = routeFor(s) === ADD_TV_IR_ROUTE;
  useEffect(() => {
    if (!goIr) return;
    router.push('/add-tv-ir');
    dispatch({ type: 'back' });
  }, [goIr, router]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Scan whenever we enter 'scanning' (mount or "Scan again").
  const scanning = s.step === 'scanning';
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    const isCancelled = (): boolean => cancelled || !alive.current;
    const onFound = (c: AddCandidate): void => {
      if (!isCancelled()) dispatch({ type: 'found', candidate: c });
    };
    const discoveryDeps = appDiscoveryDeps();
    setReport(null);
    const scan = demo
      ? demoScan(onFound, { isCancelled })
      : discoverTvs(discoveryDeps, { windowMs: discoveryDeps.udp || discoveryDeps.mdns ? 3000 : 0, onFound, isCancelled }).then((r) => {
          if (!isCancelled()) setReport(scanReport(r, t));
          return r.candidates;
        });
    scan
      .then(() => {
        // Scan first: even when nothing was found we stay on the list; the address link is a last resort.
        if (!isCancelled()) dispatch({ type: 'scanDone' });
      })
      .catch(() => {
        if (!isCancelled()) dispatch({ type: 'scanDone' });
      });
    return () => {
      cancelled = true;
    };
  }, [scanning, demo]);

  // Manual IP: probe the address once it validated.
  const probeIp = s.step === 'manual' && s.probing ? s.ip : null;
  useEffect(() => {
    if (probeIp === null) return;
    probeHost(fetchAdapter, probeIp, { timeoutMs: 2500, tlsCheck: appDiscoveryDeps().tlsCheck ?? undefined })
      .then((c) => {
        if (alive.current) dispatch({ type: 'probeResult', candidate: c });
      })
      .catch(() => {
        if (alive.current) dispatch({ type: 'probeResult', candidate: null });
      });
  }, [probeIp]);

  // Google TV pair step: ask the TV to show its code (again on "Show the code again").
  const atvHost = s.step === 'pair' && s.candidate.platform === 'androidtv' && s.candidate.pairAs === undefined ? s.candidate.host : null;
  useEffect(() => {
    if (atvHost === null || s.step !== 'pair') return;
    const d = androidTvPairingDriver(s.candidate, transport);
    if (!d) return;
    atvRef.current = d;
    setAtvPhase('starting');
    setAtvBusy(false);
    let cancelled = false;
    void startAndroidTvPairing(d).then((ev) => {
      if (cancelled || !alive.current) return;
      if (ev) {
        setAtvPhase('failed');
        dispatch(ev);
      } else setAtvPhase('ready');
    });
    return () => {
      cancelled = true;
      if (d.pairingState !== 'paired') d.cancelPairing();
    };
    // Runs per Google TV pair step (and retry); `s` is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atvHost, atvRun, transport]);

  const pairPress = (): void => {
    if (s.step !== 'pair') return;
    const d = atvRef.current;
    if (atvHost === null || s.pair.kind !== 'code') {
      dispatch({ type: 'paired' });
      return;
    }
    // Google TV: only once the TV shows its code (the keyboard's return key bypasses `disabled`).
    if (!d || atvPhase !== 'ready' || atvBusy) return;
    // An incomplete code gets the reducer's "enter all 6 characters" error, without asking the TV.
    if (!isCodeComplete(s.code, s.pair)) {
      dispatch({ type: 'paired' });
      return;
    }
    setAtvBusy(true);
    void submitAndroidTvCode(d, s.code).then((ev) => {
      if (!alive.current) return;
      setAtvBusy(false);
      // A typo keeps pairing open; anything else needs a new code.
      if (ev.type === 'pairFailed' && d.pairingState !== 'awaiting_code') setAtvPhase('failed');
      dispatch(ev);
    });
  };

  // Name step: connect, save and make it the active TV.
  const saving = s.step === 'name' && s.saving;
  useEffect(() => {
    if (!saving || s.step !== 'name') return;
    const paired = s.candidate.platform === 'androidtv' && !s.castOnly ? atvRef.current : null;
    finishAddTv(s, { transport, session, store: savedTvStore, addToSession: addTv, driver: paired })
      .then((ev) => {
        if (alive.current) dispatch(ev);
      })
      .catch((e: unknown) => {
        if (alive.current) dispatch({ type: 'saveFailed', message: e instanceof Error ? e.message : String(e) });
      });
    // Runs once per save; `s` is read at the moment saving starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  const close = (): void => {
    if (router.canGoBack()) router.back();
  };
  // Dismiss every modal in the stack (add-tv, add-tv-ir) back to the remote tab (QA run 3).
  const goRemote = (): void => {
    router.dismissTo('/remote');
  };
  // A Google TV saved for casting: straight to the Cast tab.
  const goCast = (): void => {
    router.dismissTo('/cast');
  };

  const candidateRow = (c: AddCandidate) => {
    const label = PLATFORM_LABEL[c.platform];
    const beta = BETA_PLATFORMS.has(c.platform);
    const title = c.model ?? c.name ?? t('app.addTv.platformTv', { platform: label });
    return (
      <Row
        key={c.host}
        title={title}
        subtitle={c.host}
        accessory={{ type: 'value', value: beta ? t('app.addTv.chipBeta', { platform: label }) : label, chevron: true }}
        accessibilityLabel={t(beta ? 'app.addTv.candidateLabelBeta' : 'app.addTv.candidateLabel', { title, host: c.host, platform: label })}
        onPress={() => dispatch({ type: 'pick', host: c.host })}
      />
    );
  };
  const back = (disabled?: boolean) => (
    <PillButton variant="plain" label={t('app.common.back')} disabled={disabled} onPress={() => dispatch({ type: 'back' })} style={styles.center} />
  );
  const errorText = (message: string | null | undefined) => (message ? <StepText tone="error" live>{message}</StepText> : null);

  let body: ReactElement;
  switch (s.step) {
    case 'scanning':
    case 'list':
      body = (
        <>
          <View style={[styles.block, styles.scan]} accessibilityLiveRegion="polite">
            {s.step === 'scanning' ? <ActivityIndicator color={p.tint} /> : null}
            <Text style={[textStyle('headline'), styles.flex, { color: p.label }]}>
              {s.step === 'scanning' ? t('app.addTv.scanning') : foundLabel(s.candidates.length)}
            </Text>
          </View>
          {s.candidates.length > 0 ? (
            <InsetGroupedList footer={t('app.addTv.scanHint')}>{s.candidates.map(candidateRow)}</InsetGroupedList>
          ) : (
            <View style={[styles.block, styles.gap]}>
              <StepText tone="secondary">{t('app.addTv.scanHint')}</StepText>
              {s.step === 'list' && report ? <StepText tone="secondary">{report}</StepText> : null}
            </View>
          )}
          <View style={[styles.block, styles.actions]}>
            {s.step === 'list' ? <PillButton variant="tinted" label={t('app.addTv.scanAgain')} onPress={() => dispatch({ type: 'rescan' })} /> : null}
            {lostLink}
          </View>
          <InsetGroupedList>
            {irSetupOffered(Platform.OS) ? (
              <Row
                title={t('app.addTv.irTitle')}
                subtitle={t('app.addTv.irBody')}
                accessory={{ type: 'chevron' }}
                accessibilityLabel={t('app.addTv.irRowLabel', { title: t('app.addTv.irTitle'), body: t('app.addTv.irBody') })}
                onPress={() => dispatch({ type: 'ir' })}
              />
            ) : null}
            <Row
              title={t('app.addTv.notListed')}
              accessory={{ type: 'chevron' }}
              accessibilityLabel={t('app.addTv.notListed')}
              onPress={() => dispatch({ type: 'manual' })}
            />
          </InsetGroupedList>
        </>
      );
      break;
    case 'manual':
      body = (
        <View style={[styles.block, styles.gap]}>
          <StepTitle>{t('app.addTv.enterAddress')}</StepTitle>
          <StepField
            accessibilityLabel={t('app.addTv.ipLabel')}
            inputStyle={styles.mono}
            value={s.ip}
            onChangeText={(ip) => dispatch({ type: 'ipChanged', ip })}
            placeholder="192.168.1.40"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!s.probing}
            onSubmitEditing={() => dispatch({ type: 'ipSubmit' })}
          />
          <StepText tone="secondary">{t('app.addTv.findIp')}</StepText>
          {errorText(s.error)}
          <PillButton
            stretch
            label={s.probing ? t('app.common.connecting') : t('app.addTv.connect')}
            disabled={s.probing}
            onPress={() => dispatch({ type: 'ipSubmit' })}
          />
          {back()}
        </View>
      );
      break;
    case 'unsupported':
      body = (
        <View style={[styles.block, styles.gap]}>
          <StepTitle>{s.candidate.model ?? s.candidate.name ?? PLATFORM_LABEL[s.candidate.platform]}</StepTitle>
          <StepText>{s.message}</StepText>
          {s.castOnly ? (
            <PillButton stretch label={t('app.addTv.castOnlyUse')} onPress={() => dispatch({ type: 'castOnly' })} />
          ) : null}
          {back()}
        </View>
      );
      break;
    case 'pair': {
      const c = s.candidate;
      const pr = s.pair;
      const notice = candidateNotice(c);
      body = (
        <>
          <View style={styles.block}>
            <StepTitle>{t('app.addTv.pairTitle', { name: c.model ?? c.name ?? PLATFORM_LABEL[c.platform] })}</StepTitle>
          </View>
          <NoticeCard notice={notice} />
          <View style={[styles.block, styles.gap]}>
            {notice.needsPhysicalRemoteOnce ? lostLink : null}
            {pr.kind === 'prompt' ? (
              <>
                <View style={styles.scan}>
                  <ActivityIndicator color={p.tint} />
                  <Text style={[textStyle('subheadline'), styles.flex, { color: p.label }]}>{t('app.addTv.waiting')}</Text>
                </View>
                <Callout>{t('app.addTv.allowPrompt', { message: pr.message })}</Callout>
                <PillButton stretch label={t('app.addTv.pressedAllow')} onPress={() => dispatch({ type: 'paired' })} />
              </>
            ) : pr.kind === 'psk' ? (
              <>
                <Callout>{pr.message}</Callout>
                <StepField
                  accessibilityLabel={t('app.addTv.psk')}
                  inputStyle={styles.mono}
                  value={s.code}
                  onChangeText={(code) => dispatch({ type: 'codeChanged', code })}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('app.addTv.psk')}
                  onSubmitEditing={() => dispatch({ type: 'paired' })}
                />
                <PillButton stretch label={t('app.addTv.continue')} onPress={() => dispatch({ type: 'paired' })} />
              </>
            ) : pr.kind === 'code' ? (
              <>
                {atvHost !== null && atvPhase === 'starting' ? (
                  <View style={styles.scan}>
                    <ActivityIndicator color={p.tint} />
                    <Text style={[textStyle('subheadline'), styles.flex, { color: p.label }]}>{t('app.addTv.atvStarting')}</Text>
                  </View>
                ) : null}
                <StepText>{pr.message}</StepText>
                <StepField
                  accessibilityLabel={pr.charset === 'hex' ? t('app.addTv.pairingCode') : t('app.addTv.pin')}
                  inputStyle={styles.code}
                  value={s.code}
                  onChangeText={(code) => dispatch({ type: 'codeChanged', code })}
                  maxLength={pr.length}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType={pr.charset === 'digits' ? 'number-pad' : 'default'}
                  placeholder={pr.charset === 'hex' ? 'A1B2C3' : '1234'}
                  onSubmitEditing={pairPress}
                />
                <PillButton
                  stretch
                  label={atvBusy ? t('app.common.connecting') : t('app.addTv.pair')}
                  disabled={atvHost !== null && (atvPhase !== 'ready' || atvBusy)}
                  onPress={pairPress}
                />
                {atvHost !== null && atvPhase === 'failed' ? (
                  <PillButton stretch variant="tinted" label={t('app.addTv.atvRetry')} onPress={() => setAtvRun((n) => n + 1)} />
                ) : null}
              </>
            ) : (
              <>
                {c.platform === 'roku' || c.pairAs === 'roku' ? <Callout>{t('app.addTv.rokuSetting')}</Callout> : null}
                <PillButton stretch label={t('app.addTv.doneConnect')} onPress={() => dispatch({ type: 'paired' })} />
              </>
            )}
            {errorText(s.error)}
            {back()}
          </View>
        </>
      );
      break;
    }
    case 'name':
      body = (
        <View style={[styles.block, styles.gap]}>
          <StepTitle>{t('app.addTv.nameTitle')}</StepTitle>
          <StepField
            label={t('app.common.name')}
            accessibilityLabel={t('app.common.name')}
            value={s.name}
            onChangeText={(name) => dispatch({ type: 'nameChanged', name })}
            placeholder={t('app.common.tvNamePlaceholder')}
            editable={!s.saving}
          />
          <StepField
            label={t('app.addTv.roomOptional')}
            accessibilityLabel={t('app.addTv.room')}
            value={s.room}
            onChangeText={(room) => dispatch({ type: 'roomChanged', room })}
            placeholder={t('app.addTv.roomPlaceholder')}
            editable={!s.saving}
          />
          {s.saving && s.pair.kind === 'prompt' ? <Callout live>{t('app.addTv.allowIfAsks', { message: s.pair.message })}</Callout> : null}
          {errorText(s.error)}
          <PillButton stretch label={s.saving ? t('app.common.connecting') : t('app.addTv.save')} disabled={s.saving} onPress={() => dispatch({ type: 'save' })} />
          {back(s.saving)}
        </View>
      );
      break;
    case 'ir':
      // Navigating to the infrared setup screen (see the routeFor effect); nothing to show.
      body = (
        <View style={styles.block}>
          <ActivityIndicator color={p.tint} />
        </View>
      );
      break;
    case 'saved':
      body = (
        <>
          <Card style={styles.card}>
            <StepTitle live>{t('app.common.added', { name: s.tv.name })}</StepTitle>
            <StepText tone="secondary">{s.tv.castOnly ? t('app.addTv.castOnlySaved') : t('app.addTv.nowControlling')}</StepText>
          </Card>
          <View style={[styles.block, styles.gap]}>
            {s.tv.castOnly ? (
              <PillButton stretch label={t('app.addTv.openCast')} onPress={goCast} />
            ) : (
              <PillButton stretch label={t('app.addTv.useRemote')} onPress={goRemote} />
            )}
            <PillButton stretch variant="tinted" label={t('app.addTv.addAnother')} onPress={() => dispatch({ type: 'rescan' })} />
          </View>
        </>
      );
      break;
  }

  return (
    <>
      <LargeTitleHeader
        title={t('app.addTv.title')}
        leading={<PillButton variant="plain" label={t('app.addTv.cancel')} onPress={close} />}
      >
        {body}
        {demo ? (
          <View style={styles.block}>
            <DemoNote color={p.secondaryLabel} />
          </View>
        ) : null}
      </LargeTitleHeader>
      <LostRemoteSheet visible={lostOpen} onClose={() => setLostOpen(false)} caps={s.caps} onIr={openIrFromSheet} />
    </>
  );
}

/** "Phone 192.168.1.20 · checked 253 addresses · casting check on" (or why nothing was checked). */
function scanReport(r: { localIp?: string | null; probed?: number; tlsCheck?: boolean; methods: string[] }, t: ReturnType<typeof useT>): string {
  if (!r.localIp) return t('app.addTv.reportNoIp');
  return t('app.addTv.report', {
    ip: r.localIp,
    count: r.probed ?? 0,
    cast: r.tlsCheck ? t('app.addTv.reportCastOn') : t('app.addTv.reportCastOff'),
  });
}

/** "Your TV will ask to allow Couch" etc.: what the TV will ask for, before pairing. Nothing for 'none'. */
function NoticeCard({ notice }: { notice: PairingNotice }) {
  const p = useDesign();
  const t = useT();
  if (notice.kind === 'none') return null;
  const [title, body] =
    notice.kind === 'allow'
      ? [t('app.addTv.noticeAllowTitle'), t('app.addTv.noticeAllowBody')]
      : notice.kind === 'pin'
        ? [t('app.addTv.noticePinTitle'), t('app.addTv.noticePinBody')]
        : [t('app.addTv.noticeKeyTitle'), t('app.addTv.noticeKeyBody')];
  return (
    <Card style={styles.card}>
      <Text style={[textStyle('headline'), { color: p.label }]}>{title}</Text>
      <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{body}</Text>
    </Card>
  );
}

/**
 * "Lost your remote?" sheet: TVs that need nothing pressed on the TV, the TV's own buttons, Wake for
 * TVs already paired, and infrared on Android. Content from lostRemoteHelp() (src/core/pairingNotice).
 * The shared Sheet panel draws in the app theme, so its text keeps that theme's ink/muted (their
 * contrast is tested on the panel) with the v2 type scale. The sheet keeps its own ScrollView.
 */
function LostRemoteSheet({ visible, onClose, caps, onIr }: { visible: boolean; onClose: () => void; caps: AddTvState['caps']; onIr: () => void }) {
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const [udp] = useState(() => {
    try {
      return hasUdp();
    } catch {
      return false;
    }
  });
  const help = lostRemoteHelp({ os: Platform.OS, caps, hasUdpSender: udp });
  const tag = LOCALES.find((l) => l.code === locale)?.bcp47 ?? 'en-US';
  const section = (title: string, ...lines: string[]) => (
    <View style={styles.section}>
      <Text style={[textStyle('headline'), { color: theme.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {lines.map((line) => (
        <Text key={line} style={[textStyle('subheadline'), { color: theme.ink }]}>
          {line}
        </Text>
      ))}
    </View>
  );
  return (
    <Sheet visible={visible} scroll={false} onClose={onClose} title={t('app.addTv.lostRemote')} accessibilityLabel={t('app.addTv.lostRemote')} closeLabel={t('app.addTv.lostClose')}>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
        <Text style={[textStyle('subheadline'), { color: theme.muted }]}>{t('app.addTv.lostIntro')}</Text>
        {help.noConfirm.length > 0
          ? section(t('app.addTv.lostNoConfirmTitle'), t('app.addTv.lostNoConfirmBody', { platforms: platformList(help.noConfirm, tag) }))
          : null}
        {help.needsTvOnce.length > 0
          ? section(t('app.addTv.lostButtonsTitle'), t('app.addTv.lostNeedsOnce', { platforms: platformList(help.needsTvOnce, tag) }), t('app.addTv.lostButtonsBody'))
          : section(t('app.addTv.lostButtonsTitle'), t('app.addTv.lostButtonsBody'))}
        {section(t('app.addTv.lostWakeTitle'), help.wake ? t('app.addTv.lostWakeBody') : t('app.addTv.lostWakeUnavailable'))}
        {help.ir ? (
          <>
            {section(t('app.addTv.lostIrTitle'), t('app.addTv.lostIrBody'))}
            <PillButton stretch variant="tinted" label={t('app.addTv.lostIrOpen')} onPress={onIr} />
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { marginHorizontal: list.inset, marginBottom: list.groupGap },
  gap: { gap: space.md },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  center: { alignSelf: 'center' },
  card: { marginHorizontal: list.inset, marginBottom: list.groupGap },
  mono: textStyle('numeric'),
  code: { ...textStyle('numeric'), fontSize: 22, lineHeight: 28, textAlign: 'center', letterSpacing: 6 },
  section: { gap: space.xs },
  sheetScroll: { maxHeight: 520 },
  sheetBody: { gap: space.lg, paddingBottom: space.sm },
});
