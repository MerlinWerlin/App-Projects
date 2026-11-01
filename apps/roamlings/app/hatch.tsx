import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Pet } from '../src/core/pet';
import { petName, speciesBlurb, t } from '../src/i18n';
import { actions, getGame, useGame } from '../src/store/game';
import { motion, rarityColor, space, type as ty, useColors } from '../src/theme/tokens';
import { useHaptics } from '../src/ui/haptics';
import { Button, Egg, RarityBadge, regionTint } from '../src/ui/kit';
import { PetView } from '../src/ui/PetView';

export default function Hatch() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const [crack, setCrack] = useState(0);
  const [pet, setPet] = useState<Pet | null>(null);
  const [isNew, setIsNew] = useState(false);
  const wobble = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  const shake = () => {
    if (reduce) return;
    wobble.setValue(0);
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: motion.fast, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: motion.base, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: motion.fast, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const tapEgg = () => {
    if (pet) return;
    h.tap();
    shake();
    if (crack < 2) {
      setCrack(crack + 1);
      return;
    }
    const events = actions.hatch();
    const ev = events.find((e) => e.kind === 'hatched');
    if (!ev || ev.kind !== 'hatched') {
      router.back();
      return;
    }
    const p = getGame().pets.find((x) => x.id === ev.petId) ?? null;
    setPet(p);
    setIsNew(ev.newVariant);
    h.success();
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: reduce ? 0 : motion.slow * 2, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const again = () => {
    setPet(null);
    setCrack(0);
  };

  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });
  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'space-between' }}>
      {!pet ? (
        <>
          <Text style={[ty.title, { color: c.ink }]}>{t('hatch.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('hatch.tap')} onPress={tapEgg} style={{ alignItems: 'center' }}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Egg size={240} tint={regionTint[g.region] ?? '#A08C5B'} crack={crack} />
            </Animated.View>
          </Pressable>
          <Text style={[ty.bodyBold, { color: c.ink2 }]}>{t('hatch.tap')}</Text>
        </>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            {isNew ? <Text style={[ty.bodyBold, { color: rarityColor[pet.rarity] }]}>{t('hatch.new')}</Text> : null}
            <Text style={[ty.title, { color: c.ink, textAlign: 'center' }]}>{t('hatch.met', { name: petName(pet) })}</Text>
          </View>
          <Animated.View style={{ opacity: reveal, transform: [{ scale }], alignItems: 'center', gap: space.md }}>
            <PetView pet={pet} size={260} mood="joyful" animate />
            <RarityBadge rarity={pet.rarity} />
            <Text style={[ty.body, { color: c.ink2, textAlign: 'center', maxWidth: 300 }]}>{speciesBlurb(pet.speciesId)}</Text>
            <Text style={[ty.small, { color: c.ink3 }]}>
              {t('pets.trait')}: {t(`trait.${pet.trait}`)}
            </Text>
          </Animated.View>
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            {g.eggsReady > 0 ? <Button kind="soft" label={t('hatch.again')} onPress={again} /> : null}
            <Button label={t('hatch.done')} onPress={() => router.back()} />
          </View>
        </>
      )}
    </View>
  );
}
