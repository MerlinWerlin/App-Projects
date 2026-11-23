import React, { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, usePalette } from './theme';

/**
 * iOS-standard trailing swipe action (gesture-handler's ReanimatedSwipeable: 1:1 tracking, velocity-aware release on
 * the UI thread). The action asks for confirmation before anything is deleted, and long-press stays as a fallback.
 */
export function SwipeRow({ children, onDelete, label = 'Delete' }: { children: React.ReactNode; onDelete: () => void; label?: string }) {
  const c = usePalette();
  const ref = useRef<SwipeableMethods>(null);
  return (
    <Swipeable
      ref={ref}
      friction={1}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { ref.current?.close(); onDelete(); }}
          style={{ width: 96, marginLeft: 8, borderRadius: radius.m, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{label}</Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}
