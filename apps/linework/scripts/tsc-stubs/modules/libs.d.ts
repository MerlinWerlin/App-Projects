// Offline stubs for the non-Expo native libraries Linework imports
// (react-native-gesture-handler ~2.28, react-native-safe-area-context ~5.6, react-native-svg 15.12,
// @expo/vector-icons 15, @expo-google-fonts/*, async-storage 2.2, jpeg-js 0.4). See ../README.md.

declare module 'react-native-gesture-handler' {
  import type { ComponentType, ReactNode } from 'react';
  import type { StyleProp, ViewStyle, ViewProps } from 'react-native';

  type GestureEventPayload = { handlerTag: number; numberOfPointers: number; state: number; pointerType: number };
  export type PanGestureHandlerEventPayload = {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
    translationX: number;
    translationY: number;
    velocityX: number;
    velocityY: number;
    stylusData?: unknown;
  };
  export type PinchGestureHandlerEventPayload = { scale: number; focalX: number; focalY: number; velocity: number };
  export type RotationGestureHandlerEventPayload = { rotation: number; anchorX: number; anchorY: number; velocity: number };
  export type TapGestureHandlerEventPayload = { x: number; y: number; absoluteX: number; absoluteY: number };
  export type LongPressGestureHandlerEventPayload = { x: number; y: number; absoluteX: number; absoluteY: number; duration: number };
  export type GestureStateChangeEvent<P> = GestureEventPayload & P;
  export type GestureUpdateEvent<P> = GestureEventPayload & P;
  type GestureUpdateChange<P> = GestureUpdateEvent<P> & { changeX?: number; changeY?: number; scaleChange?: number; rotationChange?: number };

  type HitSlop = number | { left?: number; right?: number; top?: number; bottom?: number; vertical?: number; horizontal?: number; width?: number; height?: number };

  // Real: GestureType = BaseGesture<any> | ...; every gesture and composition extends the abstract Gesture.
  abstract class Gesture_ {
    initialize(): void;
    toGestureArray(): GestureType[];
    prepare(): void;
  }
  export type GestureType = Gesture_;
  abstract class BaseGesture<P> extends Gesture_ {
    enabled(enabled: boolean): this;
    runOnJS(runOnJS: boolean): this;
    withRef(ref: unknown): this;
    withTestId(id: string): this;
    hitSlop(hitSlop: HitSlop): this;
    shouldCancelWhenOutside(value: boolean): this;
    cancelsTouchesInView(value: boolean): this;
    manualActivation(manualActivation: boolean): this;
    simultaneousWithExternalGesture(...gestures: GestureType[]): this;
    requireExternalGestureToFail(...gestures: GestureType[]): this;
    blocksExternalGesture(...gestures: GestureType[]): this;
    onBegin(callback: (event: GestureStateChangeEvent<P>) => void): this;
    onStart(callback: (event: GestureStateChangeEvent<P>) => void): this;
    onEnd(callback: (event: GestureStateChangeEvent<P>, success: boolean) => void): this;
    onFinalize(callback: (event: GestureStateChangeEvent<P>, success: boolean) => void): this;
    onTouchesDown(callback: (event: unknown, stateManager: unknown) => void): this;
    onTouchesMove(callback: (event: unknown, stateManager: unknown) => void): this;
    onTouchesUp(callback: (event: unknown, stateManager: unknown) => void): this;
    onTouchesCancelled(callback: (event: unknown, stateManager: unknown) => void): this;
  }
  abstract class ContinuousBaseGesture<P> extends BaseGesture<P> {
    onUpdate(callback: (event: GestureUpdateEvent<P>) => void): this;
    onChange(callback: (event: GestureUpdateChange<P>) => void): this;
  }
  export class PanGesture extends ContinuousBaseGesture<PanGestureHandlerEventPayload> {
    activeOffsetX(offset: number | number[]): this;
    activeOffsetY(offset: number | number[]): this;
    failOffsetX(offset: number | number[]): this;
    failOffsetY(offset: number | number[]): this;
    minDistance(distance: number): this;
    minPointers(minPointers: number): this;
    maxPointers(maxPointers: number): this;
    minVelocity(velocity: number): this;
    averageTouches(value: boolean): this;
    activateAfterLongPress(duration: number): this;
  }
  export class PinchGesture extends ContinuousBaseGesture<PinchGestureHandlerEventPayload> {}
  export class RotationGesture extends ContinuousBaseGesture<RotationGestureHandlerEventPayload> {}
  export class TapGesture extends BaseGesture<TapGestureHandlerEventPayload> {
    minPointers(minPointers: number): this;
    numberOfTaps(count: number): this;
    maxDistance(maxDist: number): this;
    maxDuration(duration: number): this;
    maxDelay(delay: number): this;
    maxDeltaX(delta: number): this;
    maxDeltaY(delta: number): this;
  }
  export class LongPressGesture extends BaseGesture<LongPressGestureHandlerEventPayload> {
    minDuration(duration: number): this;
    maxDistance(distance: number): this;
    numberOfPointers(pointers: number): this;
  }
  export class ComposedGesture extends Gesture_ {}
  export class SimultaneousGesture extends ComposedGesture {}
  export class ExclusiveGesture extends ComposedGesture {}
  export type RaceGesture = ComposedGesture;
  export type ComposedGestureType = ComposedGesture;

  export const Gesture: {
    Tap(): TapGesture;
    Pan(): PanGesture;
    Pinch(): PinchGesture;
    Rotation(): RotationGesture;
    LongPress(): LongPressGesture;
    Race(...gestures: GestureType[]): ComposedGesture;
    Simultaneous(...gestures: GestureType[]): SimultaneousGesture;
    Exclusive(...gestures: GestureType[]): ExclusiveGesture;
  };

  export interface GestureDetectorProps {
    gesture: GestureType;
    userSelect?: 'none' | 'auto' | 'text';
    enableContextMenu?: boolean;
    touchAction?: string;
    children?: ReactNode;
  }
  export const GestureDetector: ComponentType<GestureDetectorProps>;
  export interface GestureHandlerRootViewProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
  }
  export const GestureHandlerRootView: ComponentType<GestureHandlerRootViewProps>;
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
  export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  export interface Metrics {
    insets: EdgeInsets;
    frame: Rect;
  }
  export type Edge = 'top' | 'right' | 'bottom' | 'left';
  export type EdgeMode = 'off' | 'additive' | 'maximum';
  export type EdgeRecord = Partial<Record<Edge, EdgeMode>>;
  export type Edges = readonly Edge[] | Readonly<EdgeRecord>;
  export interface SafeAreaViewProps extends ViewProps {
    mode?: 'padding' | 'margin';
    edges?: Edges;
  }
  export const SafeAreaView: ComponentType<SafeAreaViewProps>;
  export interface SafeAreaProviderProps extends ViewProps {
    children?: ReactNode;
    initialMetrics?: Metrics | null;
    initialSafeAreaInsets?: EdgeInsets | null;
  }
  export const SafeAreaProvider: ComponentType<SafeAreaProviderProps>;
  export function useSafeAreaInsets(): EdgeInsets;
  export function useSafeAreaFrame(): Rect;
  export const initialWindowMetrics: Metrics | null;
}

declare module 'react-native-svg' {
  import type { Component, ReactNode } from 'react';
  import type { ColorValue, StyleProp, ViewStyle, ViewProps, GestureResponderEvent, LayoutChangeEvent } from 'react-native';

  type NumberProp = string | number;
  type NumberArray = NumberProp[] | NumberProp;
  type FillRule = 'evenodd' | 'nonzero';
  type Linecap = 'butt' | 'square' | 'round';
  type Linejoin = 'miter' | 'bevel' | 'round';
  type TransformProp = string | ReadonlyArray<object> | object;

  interface FillProps {
    fill?: ColorValue;
    fillOpacity?: NumberProp;
    fillRule?: FillRule;
  }
  interface StrokeProps {
    stroke?: ColorValue;
    strokeWidth?: NumberProp;
    strokeOpacity?: NumberProp;
    strokeDasharray?: Readonly<NumberArray>;
    strokeDashoffset?: NumberProp;
    strokeLinecap?: Linecap;
    strokeLinejoin?: Linejoin;
    strokeMiterlimit?: NumberProp;
    vectorEffect?: 'none' | 'non-scaling-stroke' | 'nonScalingStroke' | 'default' | 'inherit' | 'uri';
  }
  interface TransformProps {
    translate?: NumberArray;
    translateX?: NumberProp;
    translateY?: NumberProp;
    origin?: NumberArray;
    originX?: NumberProp;
    originY?: NumberProp;
    scale?: NumberArray;
    scaleX?: NumberProp;
    scaleY?: NumberProp;
    skew?: NumberArray;
    skewX?: NumberProp;
    skewY?: NumberProp;
    rotation?: NumberProp;
    x?: NumberArray;
    y?: NumberArray;
    transform?: TransformProp;
  }
  interface CommonPathProps extends FillProps, StrokeProps, TransformProps {
    children?: ReactNode;
    opacity?: NumberProp;
    clipPath?: string;
    clipRule?: FillRule;
    mask?: string;
    marker?: string;
    markerStart?: string;
    markerMid?: string;
    markerEnd?: string;
    filter?: string;
    id?: string;
    testID?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    onPress?: (event: GestureResponderEvent) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
    accessible?: boolean;
    accessibilityLabel?: string;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  }

  export interface SvgProps extends Omit<CommonPathProps, 'x' | 'y'>, Omit<ViewProps, 'pointerEvents' | 'onLayout'> {
    width?: NumberProp;
    height?: NumberProp;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: ColorValue;
    title?: string;
    style?: StyleProp<ViewStyle>;
  }
  export default class Svg extends Component<SvgProps> {}
  export { Svg };

  export interface GProps extends CommonPathProps {
    opacity?: NumberProp;
  }
  export class G extends Component<GProps> {}
  export class Defs extends Component<{ children?: ReactNode }> {}

  export interface PathProps extends CommonPathProps {
    d?: string;
  }
  export class Path extends Component<PathProps> {}

  export interface RectProps extends Omit<CommonPathProps, 'x' | 'y'> {
    x?: NumberProp;
    y?: NumberProp;
    width?: NumberProp;
    height?: NumberProp;
    rx?: NumberProp;
    ry?: NumberProp;
  }
  export class Rect extends Component<RectProps> {}

  export interface CircleProps extends CommonPathProps {
    cx?: NumberProp;
    cy?: NumberProp;
    r?: NumberProp;
  }
  export class Circle extends Component<CircleProps> {}

  export interface EllipseProps extends CommonPathProps {
    cx?: NumberProp;
    cy?: NumberProp;
    rx?: NumberProp;
    ry?: NumberProp;
  }
  export class Ellipse extends Component<EllipseProps> {}

  export interface LineProps extends CommonPathProps {
    x1?: NumberProp;
    x2?: NumberProp;
    y1?: NumberProp;
    y2?: NumberProp;
  }
  export class Line extends Component<LineProps> {}

  export interface PolylineProps extends CommonPathProps {
    points?: string | ReadonlyArray<NumberProp>;
  }
  export class Polyline extends Component<PolylineProps> {}
  export class Polygon extends Component<PolylineProps> {}

  type Units = 'userSpaceOnUse' | 'objectBoundingBox';
  export interface PatternProps extends TransformProps {
    children?: ReactNode;
    id?: string;
    x?: NumberProp;
    y?: NumberProp;
    width?: NumberProp;
    height?: NumberProp;
    patternTransform?: TransformProp;
    patternUnits?: Units;
    patternContentUnits?: Units;
    viewBox?: string;
    preserveAspectRatio?: string;
  }
  export class Pattern extends Component<PatternProps> {}

  export interface LinearGradientProps {
    children?: ReactNode;
    x1?: NumberProp;
    x2?: NumberProp;
    y1?: NumberProp;
    y2?: NumberProp;
    gradientUnits?: Units;
    gradientTransform?: TransformProp;
    id?: string;
  }
  export class LinearGradient extends Component<LinearGradientProps> {}
  export interface RadialGradientProps {
    children?: ReactNode;
    fx?: NumberProp;
    fy?: NumberProp;
    rx?: NumberProp;
    ry?: NumberProp;
    cx?: NumberProp;
    cy?: NumberProp;
    r?: NumberProp;
    gradientUnits?: Units;
    gradientTransform?: TransformProp;
    id?: string;
  }
  export class RadialGradient extends Component<RadialGradientProps> {}

  export interface StopProps {
    stopColor?: ColorValue;
    stopOpacity?: NumberProp;
    offset?: NumberProp;
  }
  export class Stop extends Component<StopProps> {}

  export class ClipPath extends Component<{ id?: string; children?: ReactNode }> {}
  export class Mask extends Component<{ id?: string; x?: NumberProp; y?: NumberProp; width?: NumberProp; height?: NumberProp; maskUnits?: Units; children?: ReactNode }> {}
}

declare module '@expo/vector-icons' {
  import type { Component } from 'react';
  import type { TextProps, ColorValue } from 'react-native';
  // Real glyph maps are generated (Feather ~287 names, Ionicons ~1300). The stub types names as string so it
  // never false-errors; a typo'd icon name is NOT caught offline.
  export interface IconProps<GLYPHS extends string> extends TextProps {
    name: GLYPHS;
    size?: number;
    color?: string | ColorValue;
  }
  interface IconComponent<G extends string> {
    new (props: IconProps<G>): Component<IconProps<G>>;
    glyphMap: Record<G, number | string>;
    getRawGlyphMap(): Record<G, number | string>;
    hasIcon(name: string): name is G;
  }
  export const Feather: IconComponent<string>;
  export const Ionicons: IconComponent<string>;
  export const MaterialIcons: IconComponent<string>;
  export const MaterialCommunityIcons: IconComponent<string>;
}

declare module '@expo-google-fonts/fraunces' {
  export function useFonts(map: Record<string, number | string>): [boolean, Error | null];
  export const Fraunces_600SemiBold: number;
  export const Fraunces_700Bold: number;
  export const Fraunces_400Regular: number;
  export const Fraunces_500Medium: number;
}

declare module '@expo-google-fonts/inter' {
  export function useFonts(map: Record<string, number | string>): [boolean, Error | null];
  export const Inter_400Regular: number;
  export const Inter_500Medium: number;
  export const Inter_600SemiBold: number;
  export const Inter_700Bold: number;
}

declare module '@react-native-async-storage/async-storage' {
  type Callback = (error?: Error | null) => void;
  type CallbackWithResult<T> = (error?: Error | null, result?: T | null) => void;
  export type AsyncStorageStatic = {
    getItem: (key: string, callback?: CallbackWithResult<string>) => Promise<string | null>;
    setItem: (key: string, value: string, callback?: Callback) => Promise<void>;
    removeItem: (key: string, callback?: Callback) => Promise<void>;
    mergeItem: (key: string, value: string, callback?: Callback) => Promise<void>;
    clear: (callback?: Callback) => Promise<void>;
    getAllKeys: (callback?: CallbackWithResult<readonly string[]>) => Promise<readonly string[]>;
    multiGet: (keys: readonly string[]) => Promise<readonly [string, string | null][]>;
    multiSet: (keyValuePairs: [string, string][]) => Promise<void>;
    multiRemove: (keys: readonly string[]) => Promise<void>;
  };
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

declare module 'jpeg-js' {
  export interface RawImageData<T> {
    width: number;
    height: number;
    data: T;
  }
  type BufferRet = RawImageData<Buffer>;
  type UintArrRet = RawImageData<Uint8Array>;
  type ImageData = BufferRet | UintArrRet;
  type BufferLike = Buffer | Uint8Array | ArrayLike<number> | Iterable<number> | ArrayBuffer;
  export interface DecodeOptions {
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  }
  export function encode(imgData: RawImageData<BufferLike> & { comments?: string[] }, quality?: number): BufferRet;
  export function decode(jpegData: BufferLike, opts: DecodeOptions & { useTArray: true }): UintArrRet & { exifBuffer?: Uint8Array; comments?: string[] };
  export function decode(jpegData: BufferLike, opts?: DecodeOptions): BufferRet & { exifBuffer?: Buffer; comments?: string[] };
}
