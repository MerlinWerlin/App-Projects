// Settings > Satchel Plus (T16): what Plus adds (only what this build has), the price from the App Store, and
// Unlock and Restore purchases side by side on the same screen. No timers, no nags; it never pops up on its own.
// A failure alert always says nothing was charged and shows the store's error codes in brackets.
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space } from '../theme/tokens.ts';
import { FadeInView, SectionHeader } from '../ui/hero.tsx';
import { Body, Button, Card } from '../ui/kit.tsx';
import { bracketCodes } from './store.ts';
import { buyPlus, refreshPlusPrice, restorePlus, usePlus } from './usePlus.ts';

export function PlusSection() {
  const { t, theme } = useApp();
  const plus = usePlus();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    refreshPlusPrice();
    return () => {
      mounted.current = false;
    };
  }, []);

  const ok = [{ text: t('plus.ok') }];
  const done = () => mounted.current && setBusy(false);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await buyPlus();
      if (r.status === 'owned') Alert.alert(t('plus.doneTitle'), t('plus.doneBody'), ok);
      else if (r.status === 'unavailable') Alert.alert(t('plus.unavailableTitle'), t('plus.unavailableBody', { codes: bracketCodes(r.codes) }).trim(), ok);
      else if (r.status === 'failed') Alert.alert(t('plus.failTitle'), t('plus.failBody', { codes: bracketCodes(r.codes) }).trim(), ok);
      // cancelled: the person closed the sheet themselves, so no alert
    } finally {
      done();
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await restorePlus();
      if (r.status === 'owned') Alert.alert(t('plus.restoredTitle'), t('plus.restoredBody'), ok);
      else if (r.status === 'none') Alert.alert(t('plus.restoreNoneTitle'), t('plus.restoreNoneBody'), ok);
      else Alert.alert(t('plus.unavailableTitle'), t('plus.restoreFailBody', { codes: bracketCodes(r.codes) }).trim(), ok);
    } finally {
      done();
    }
  };

  const stub = plus.availability === 'stub';
  return (
    <FadeInView style={{ gap: space.s }}>
      <SectionHeader title={t('plus.title')} icon="sparkles-outline" tone="accent" />
      <Card>
        <Body>{t('plus.oneTime')}</Body>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>
          {t('plus.featuresHeading')}
        </Text>
        <Body>{t('plus.feature.cities')}</Body>
        <Body muted>{t('plus.free')}</Body>
        {plus.owned ? (
          <>
            <View style={{ alignSelf: 'flex-start', backgroundColor: theme.okSoft, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.ok }}>{t('plus.ownedBadge')}</Text>
            </View>
            <Body>{t('plus.owned')}</Body>
          </>
        ) : stub ? (
          <Body>{t('plus.included')}</Body>
        ) : (
          <>
            {busy ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
                {t('plus.working')}
              </Text>
            ) : null}
            <Button
              label={plus.price ? t('plus.unlockPrice', { price: plus.price }) : t('plus.unlock')}
              hint={t('plus.unlockHint')}
              icon="lock-open-outline"
              onPress={unlock}
            />
            {plus.price ? null : <Body muted>{t('plus.priceLater')}</Body>}
          </>
        )}
        {stub ? null : <Button label={t('plus.restore')} hint={t('plus.restoreHint')} kind="secondary" icon="refresh-outline" onPress={restore} />}
      </Card>
    </FadeInView>
  );
}
