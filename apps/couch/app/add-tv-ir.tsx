import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { IrDriver } from '../src/core/drivers/ir';
import { IR_BRAND_CHOICES } from '../src/core/ir/codes';
import { IrSetup, type IrSetupState } from '../src/core/ir/setup';
import type { Tv } from '../src/core/types';
import { useT } from '../src/i18n/react';
import { loadIrTransmitter } from '../src/native/ir';
import { useSession } from '../src/state/session';
import { addTv, savedTvStore } from '../src/state/tvs';
import { list, space, textStyle } from '../src/theme/design';
import { Callout, StepField, StepText, StepTitle } from '../src/ui/addTv/parts';
import { RemoteIcon } from '../src/ui/icons/RemoteIcon';
import { Text } from '../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

/** Splits a `...Rich` message around its {slot} so the slot can be a nested styled element. */
function splitRich(text: string, slot: string): [string, string] {
  const i = text.indexOf(slot);
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + slot.length)];
}

/**
 * Set up a TV over infrared, design v2 (market-1018 M3, docs/DESIGN_V2.md): large title with a Back
 * pill, brands as an inset-grouped list, the code under test in a Card with a tinted "Volume up" pill,
 * then "did it work?" pills and the name field.
 * Flow (prototype v2 irSheet / irTest / irSave). Logic is the pure
 * src/core/ir/setup.ts state machine; this screen renders it. Without an IR emitter (iPhone, Expo Go,
 * most Android phones) loadIrTransmitter() is null and the screen only explains that.
 * IR codes are UNVERIFIED on real TVs.
 */
export default function AddTvIrScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const tip = t('app.addTvIr.tip');
  const { session, snap } = useSession();
  const [transmitter] = useState(() => loadIrTransmitter());
  // Ref so the default "TV n" name sees the TVs as they are at save time, not at first render.
  const names = useRef<string[]>([]);
  names.current = snap.demo ? [] : snap.tvs.map((tv) => tv.name);
  const [setup] = useState(() => (transmitter ? new IrSetup(transmitter, () => names.current) : null));
  const [s, setS] = useState<IrSetupState>(() => setup?.state ?? { step: 'brand' });

  useEffect(() => {
    if (!setup) return;
    return setup.subscribe(() => setS(setup.state));
  }, [setup]);

  const close = (): void => {
    if (router.canGoBack()) router.back();
  };

  const save = (): void => {
    if (!setup || !transmitter) return;
    const cur = setup.state;
    const from = cur.step === 'naming' ? cur.candidate.codeSet : null;
    if (!from) return;
    const draft = setup.save();
    if (!draft) return;
    const tv: Tv = {
      id: `ir-${Date.now().toString(36)}`,
      host: '',
      name: draft.name,
      model: draft.model,
      platform: 'ir',
      irBrand: draft.irBrand,
      irSet: draft.irSet,
    };
    addTv(session, tv, new IrDriver(from, transmitter));
    // Persist with the code set as (irBrand, irSet) so driverFor() can rebuild it on the next start.
    savedTvStore
      .add(tv)
      .then(() => savedTvStore.setLastUsed(tv.id))
      .catch(() => {});
    router.dismissTo('/remote');
  };

  let body: ReactElement;
  if (!setup) {
    body = (
      <View style={[styles.block, styles.gap]}>
        <StepTitle>{t('app.addTvIr.heading')}</StepTitle>
        <Callout>{tip}</Callout>
        <StepText live>{t('app.addTvIr.noBlaster')}</StepText>
        <PillButton variant="plain" label={t('app.common.back')} onPress={close} style={styles.center} />
      </View>
    );
  } else {
    switch (s.step) {
      case 'brand':
      case 'exhausted':
        body = (
          <>
            <View style={[styles.block, styles.gap]}>
              <StepTitle>{t('app.addTvIr.heading')}</StepTitle>
              {s.step === 'exhausted' ? (
                <StepText tone="error" live>
                  {s.message}
                </StepText>
              ) : null}
              <Callout>{tip}</Callout>
            </View>
            <InsetGroupedList header={t('app.addTvIr.whichBrand')}>
              {IR_BRAND_CHOICES.map((b) => (
                <Row key={b} title={b} accessory={{ type: 'chevron' }} accessibilityLabel={b} onPress={() => setup.pickBrand(b)} />
              ))}
            </InsetGroupedList>
          </>
        );
        break;
      case 'testing': {
        const [pointBefore, pointAfter] = splitRich(t('app.addTvIr.pointRich'), '{button}');
        body = (
          <>
            <View style={[styles.block, styles.gap]}>
              <StepTitle>{t('app.addTvIr.findCode', { brand: s.choice })}</StepTitle>
              <Text style={[textStyle('subheadline'), { color: p.label }]}>
                {pointBefore}
                <Text style={styles.bold}>{t('app.addTvIr.volumeUp')}</Text>
                {pointAfter}
              </Text>
            </View>
            <Card style={styles.card}>
              <View style={styles.irstep}>
                <Text style={[styles.num, { color: p.label }]}>{s.n}</Text>
                <View style={styles.flex}>
                  <Text style={[textStyle('headline'), { color: p.label }]}>{t('app.addTvIr.codeOf', { n: s.n, total: s.total })}</Text>
                  <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{t('app.addTvIr.codeHint')}</Text>
                </View>
              </View>
              <PillButton
                stretch
                variant="tinted"
                label={t('app.addTvIr.volumeUp')}
                accessibilityLabel={t('app.addTvIr.sendVolumeUp')}
                icon={<RemoteIcon name="volUp" size={20} color={p.tintedLabel} />}
                disabled={s.sending}
                onPress={() => {
                  void setup.sendTest();
                }}
              />
            </Card>
            <View style={[styles.block, styles.gap]}>
              {s.error ? (
                <StepText tone="error" live>
                  {s.error}
                </StepText>
              ) : null}
              <StepText>{t('app.addTvIr.didItWork')}</StepText>
              <View style={styles.split}>
                <PillButton variant="tinted" label={t('app.addTvIr.tryNext')} onPress={() => setup.no()} style={styles.half} />
                <PillButton label={t('app.addTvIr.itWorked')} onPress={() => setup.yes()} style={styles.half} />
              </View>
              <PillButton variant="plain" label={t('app.addTvIr.anotherBrand')} onPress={() => setup.restart()} style={styles.center} />
            </View>
          </>
        );
        break;
      }
      case 'naming':
        body = (
          <View style={[styles.block, styles.gap]}>
            <StepTitle>{t('app.addTvIr.codeWorks', { n: s.n })}</StepTitle>
            <StepText tone="secondary">{t('app.addTvIr.willUse')}</StepText>
            <StepField
              label={t('app.common.name')}
              accessibilityLabel={t('app.common.name')}
              value={s.name}
              onChangeText={(name) => setup.setName(name)}
              placeholder={t('app.common.tvNamePlaceholder')}
              onSubmitEditing={save}
            />
            <PillButton stretch label={t('app.addTvIr.saveTv')} onPress={save} />
          </View>
        );
        break;
      case 'done':
        body = (
          <View style={styles.block}>
            <StepTitle live>{t('app.common.added', { name: s.tv.name })}</StepTitle>
          </View>
        );
        break;
    }
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <LargeTitleHeader
        title={t('app.addTvIr.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={close} />}
      >
        {body}
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  block: { marginHorizontal: list.inset, marginBottom: list.groupGap },
  gap: { gap: space.md },
  card: { marginHorizontal: list.inset, marginBottom: list.groupGap },
  center: { alignSelf: 'center' },
  flex: { flex: 1, gap: space.xxs },
  bold: { fontWeight: '600' },
  irstep: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  num: { ...textStyle('numeric'), fontSize: 22, lineHeight: 28, minWidth: 40, textAlign: 'center' },
  // Two answers side by side; at large text sizes each wraps onto its own line.
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  half: { flexGrow: 1, flexBasis: 140 },
});
