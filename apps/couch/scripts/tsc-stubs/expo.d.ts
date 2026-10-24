// Offline type stubs for the Expo / community modules Couch imports statically (oversight D75-1).
// Modules loaded through guarded require() in src/native are typed by their wrappers instead.

declare module 'expo-router' {
  import type { ComponentType, ReactNode } from 'react';
  type Href = string | { pathname: string; params?: Record<string, string | number | undefined> };
  export interface Router {
    push(href: Href): void;
    navigate(href: Href): void;
    replace(href: Href): void;
    back(): void;
    canGoBack(): boolean;
    dismiss(count?: number): void;
    dismissTo(href: Href): void;
    dismissAll(): void;
    setParams(params: Record<string, string | undefined>): void;
  }
  export function useRouter(): Router;
  export const router: Router;
  export function usePathname(): string;
  export function useSegments(): string[];
  export function useLocalSearchParams<T extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>>(): Partial<T>;
  export function useFocusEffect(effect: () => void | (() => void)): void;
  export function useNavigation(): any;
  type ScreenProps = { name?: string; options?: Record<string, any> | ((props: any) => Record<string, any>); redirect?: boolean; initialParams?: Record<string, any>; listeners?: any };
  type NavigatorProps = { children?: ReactNode; screenOptions?: Record<string, any> | ((props: any) => Record<string, any>); initialRouteName?: string; tabBar?: (props: any) => ReactNode; [key: string]: any };
  export const Stack: ComponentType<NavigatorProps> & { Screen: ComponentType<ScreenProps> };
  export const Tabs: ComponentType<NavigatorProps> & { Screen: ComponentType<ScreenProps> };
  export const Redirect: ComponentType<{ href: Href }>;
  export const Link: ComponentType<{ href: Href; asChild?: boolean; children?: ReactNode; [key: string]: any }>;
  export const Slot: ComponentType<{}>;
}

declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
    Soft = 'soft',
    Rigid = 'rigid',
  }
  export enum NotificationFeedbackType {
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
  }
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hideAsync(): Promise<void>;
  export function hide(): void;
  export function setOptions(options: { duration?: number; fade?: boolean }): void;
}

declare module 'expo-blur' {
  import type { Component } from 'react';
  import type { ViewProps } from 'react-native';
  export type BlurTint =
    | 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent'
    | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial'
    | 'systemChromeMaterial' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight'
    | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight'
    | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark'
    | 'systemThickMaterialDark' | 'systemChromeMaterialDark';
  export interface BlurViewProps extends ViewProps {
    tint?: BlurTint;
    intensity?: number;
    experimentalBlurMethod?: 'none' | 'dimezisBlurView';
  }
  export class BlurView extends Component<BlurViewProps> {}
}

declare module 'expo-status-bar' {
  import type { ComponentType } from 'react';
  export const StatusBar: ComponentType<{ style?: 'auto' | 'inverted' | 'light' | 'dark'; hidden?: boolean; animated?: boolean }>;
}

declare module 'expo-font' {
  export function useFonts(map: Record<string, unknown>): [boolean, Error | null];
  export function loadAsync(map: Record<string, unknown>): Promise<void>;
}

declare module '@expo-google-fonts/sora' {
  export const Sora_600SemiBold: number;
  export const Sora_700Bold: number;
}
declare module '@expo-google-fonts/manrope' {
  export const Manrope_400Regular: number;
  export const Manrope_600SemiBold: number;
  export const Manrope_700Bold: number;
}
declare module '@expo-google-fonts/jetbrains-mono' {
  export const JetBrainsMono_400Regular: number;
}

declare module 'react-native-safe-area-context' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ViewProps } from 'react-native';
  export interface EdgeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }
  export type Edge = 'top' | 'right' | 'bottom' | 'left';
  export function useSafeAreaInsets(): EdgeInsets;
  export const SafeAreaProvider: ComponentType<{ children?: ReactNode; initialMetrics?: any; style?: any }>;
  export const SafeAreaView: ComponentType<ViewProps & { edges?: readonly Edge[] }>;
}

declare module 'react-native-svg' {
  import type { Component, ReactNode } from 'react';
  type NumberProp = number | string;
  interface SvgCommon {
    children?: ReactNode;
    fill?: string;
    fillOpacity?: NumberProp;
    fillRule?: 'evenodd' | 'nonzero';
    stroke?: string;
    strokeWidth?: NumberProp;
    strokeOpacity?: NumberProp;
    strokeLinecap?: 'butt' | 'square' | 'round';
    strokeLinejoin?: 'miter' | 'bevel' | 'round';
    strokeDasharray?: NumberProp | readonly NumberProp[];
    opacity?: NumberProp;
    transform?: string | any;
    clipPath?: string;
    mask?: string;
    [key: string]: any;
  }
  export interface SvgProps extends SvgCommon {
    width?: NumberProp;
    height?: NumberProp;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: string;
    style?: any;
  }
  export default class Svg extends Component<SvgProps> {}
  export class Svg extends Component<SvgProps> {}
  export class Path extends Component<SvgCommon & { d: string }> {}
  export class Circle extends Component<SvgCommon & { cx?: NumberProp; cy?: NumberProp; r?: NumberProp }> {}
  export class Ellipse extends Component<SvgCommon & { cx?: NumberProp; cy?: NumberProp; rx?: NumberProp; ry?: NumberProp }> {}
  export class Rect extends Component<SvgCommon & { x?: NumberProp; y?: NumberProp; width?: NumberProp; height?: NumberProp; rx?: NumberProp; ry?: NumberProp }> {}
  export class Polygon extends Component<SvgCommon & { points: string }> {}
  export class G extends Component<SvgCommon> {}
  export class Defs extends Component<{ children?: ReactNode }> {}
  export class LinearGradient extends Component<SvgCommon & { id: string; x1?: NumberProp; y1?: NumberProp; x2?: NumberProp; y2?: NumberProp; gradientUnits?: string }> {}
  export class RadialGradient extends Component<SvgCommon & { id: string; cx?: NumberProp; cy?: NumberProp; r?: NumberProp; fx?: NumberProp; fy?: NumberProp; gradientUnits?: string }> {}
  export class Stop extends Component<{ offset: NumberProp; stopColor?: string; stopOpacity?: NumberProp }> {}
  export class Pattern extends Component<SvgCommon & { id: string; width?: NumberProp; height?: NumberProp; patternUnits?: string; x?: NumberProp; y?: NumberProp }> {}
}

declare module 'expo-constants' {
  // Subset of expo-constants used by app/feedback.tsx (stub gap, D75-1).
  const Constants: {
    expoConfig?: { version?: string; name?: string; [key: string]: unknown } | null;
    platform?: { ios?: { model?: string | null; buildNumber?: string | null }; android?: { versionCode?: number | null } };
    [key: string]: unknown;
  };
  export default Constants;
}
