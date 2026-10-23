/**
 * Optional blur view for BlurMaterial (market-1018 M3).
 *
 * v2 components never import expo-blur directly: app/_layout.tsx imports BlurView and calls
 * registerBlurView(BlurView) once at startup (oversight D72-1; expo-blur ships in Expo Go and the
 * trial kit installs the SDK-correct pin). When nothing is registered (unit tests, or a build that
 * drops the module) every material draws its solid fallback, which already meets WCAG AA.
 */
import type { ComponentType, ReactNode } from 'react';

export interface BlurViewLikeProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: unknown;
  children?: ReactNode;
}

export type BlurViewLike = ComponentType<BlurViewLikeProps>;

let impl: BlurViewLike | null = null;

export function registerBlurView(component: BlurViewLike | null): void {
  impl = component;
}

export function registeredBlurView(): BlurViewLike | null {
  return impl;
}
