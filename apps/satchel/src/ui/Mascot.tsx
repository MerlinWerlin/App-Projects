// Satchel's mascot: an original 1930s rubber-hose style satchel with arms, legs and white gloves (hand-painted art,
// transparent PNGs in assets/mascot, made with Nano Banana Pro in Google Flow; see assets/mascot/README.md).
// One pose per tab: Trips home (holiday hat and a small margarita), Map (holding a map), Itinerary (checking a
// pocket watch), Wallet (flap open, tickets inside), Emergency (leg in a cast, still smiling). Decorative only:
// hidden from screen readers, small, with a slow idle bob that Reduce Motion turns off.
import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Image, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useApp } from '../state/app.tsx';

export const MASCOT_POSES = ['home', 'map', 'itinerary', 'wallet', 'emergency'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

const ART: Record<MascotPose, ImageSourcePropType> = {
  home: require('../../assets/mascot/home.png'),
  map: require('../../assets/mascot/map.png'),
  itinerary: require('../../assets/mascot/itinerary.png'),
  wallet: require('../../assets/mascot/wallet.png'),
  emergency: require('../../assets/mascot/emergency.png'),
};

export const Mascot = memo(function Mascot({ pose, size = 112, style }: { pose: MascotPose; size?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useApp();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.03] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, transform: [{ translateY }, { rotate }] }, style]}
    >
      <Image source={ART[pose]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
});
