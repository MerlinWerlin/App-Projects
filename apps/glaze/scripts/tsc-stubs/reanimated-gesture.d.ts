// Hand-written approximations of react-native-reanimated 4.1, react-native-worklets 0.5 and
// react-native-gesture-handler 2.28 for the cloud strict-tsc harness (D74-3).

declare module 'react-native-reanimated' {
  import type { ComponentType, ComponentProps, RefAttributes, ReactNode } from 'react';
  import type {
    View as RNView,
    Text as RNText,
    Image as RNImage,
    ScrollView as RNScrollView,
    FlatList as RNFlatList,
    FlatListProps,
    NativeScrollEvent,
    ViewStyle,
    TextStyle,
    ImageStyle,
  } from 'react-native';

  export interface SharedValue<Value = unknown> {
    value: Value;
    get(): Value;
    set(value: Value | ((value: Value) => Value)): void;
    addListener: (listenerID: number, listener: (value: Value) => void) => void;
    removeListener: (listenerID: number) => void;
    modify: (modifier?: <T extends Value>(value: T) => T, forceUpdate?: boolean) => void;
  }
  export type DerivedValue<Value = unknown> = Readonly<SharedValue<Value>>;
  export type AnimatableValue = number | string | number[] | { [key: string]: any };

  export function useSharedValue<Value>(initialValue: Value): SharedValue<Value>;
  export function useDerivedValue<Value>(updater: () => Value, dependencies?: unknown[]): DerivedValue<Value>;
  export function useAnimatedStyle<Style extends ViewStyle | TextStyle | ImageStyle | { [key: string]: any }>(
    updater: () => Style,
    dependencies?: unknown[] | null,
  ): Style;
  export function useAnimatedProps<Props extends object>(updater: () => Partial<Props>, dependencies?: unknown[] | null): Partial<Props>;
  export function useAnimatedReaction<PreparedResult>(
    prepare: () => PreparedResult,
    react: (prepared: PreparedResult, previous: PreparedResult | null) => void,
    dependencies?: unknown[],
  ): void;
  export interface ScrollHandlers<Context extends Record<string, unknown> = Record<string, unknown>> {
    onScroll?: (event: ReanimatedScrollEvent, context: Context) => void;
    onBeginDrag?: (event: ReanimatedScrollEvent, context: Context) => void;
    onEndDrag?: (event: ReanimatedScrollEvent, context: Context) => void;
    onMomentumBegin?: (event: ReanimatedScrollEvent, context: Context) => void;
    onMomentumEnd?: (event: ReanimatedScrollEvent, context: Context) => void;
  }
  export type ReanimatedScrollEvent = NativeScrollEvent & { eventName: string };
  export type ScrollHandlerProcessed<Context extends Record<string, unknown> = Record<string, unknown>> = ((event: any) => void) & {
    __scrollHandler?: Context;
  };
  export function useAnimatedScrollHandler<Context extends Record<string, unknown> = Record<string, unknown>>(
    handlers: ((event: ReanimatedScrollEvent, context: Context) => void) | ScrollHandlers<Context>,
    dependencies?: unknown[],
  ): ScrollHandlerProcessed<Context>;
  export function useAnimatedRef<T = any>(): { current: T | null } & (() => number | null);
  export function useReducedMotion(): boolean;
  export function useScrollViewOffset(ref: any, initial?: SharedValue<number> | null): SharedValue<number>;

  export type EasingFunction = (t: number) => number;
  export interface EasingFunctionFactory {
    factory: () => EasingFunction;
  }
  export const Easing: {
    linear: EasingFunction;
    ease: EasingFunction;
    quad: EasingFunction;
    cubic: EasingFunction;
    poly(n: number): EasingFunction;
    sin: EasingFunction;
    circle: EasingFunction;
    exp: EasingFunction;
    elastic(bounciness?: number): EasingFunction;
    back(s?: number): EasingFunction;
    bounce: EasingFunction;
    bezier(x1: number, y1: number, x2: number, y2: number): EasingFunctionFactory;
    bezierFn(x1: number, y1: number, x2: number, y2: number): EasingFunction;
    steps(n?: number, roundToNextStep?: boolean): EasingFunction;
    in(easing: EasingFunction): EasingFunction;
    out(easing: EasingFunction): EasingFunction;
    inOut(easing: EasingFunction): EasingFunction;
  };

  export type ReduceMotion = 'system' | 'always' | 'never';
  export const ReduceMotion: { System: 'system'; Always: 'always'; Never: 'never' };
  export type AnimationCallback = (finished?: boolean, current?: AnimatableValue) => void;
  export interface WithTimingConfig {
    duration?: number;
    easing?: EasingFunction | EasingFunctionFactory;
    reduceMotion?: ReduceMotion;
  }
  export interface WithSpringConfig {
    stiffness?: number;
    overshootClamping?: boolean;
    restDisplacementThreshold?: number;
    restSpeedThreshold?: number;
    velocity?: number;
    reduceMotion?: ReduceMotion;
    mass?: number;
    damping?: number;
    duration?: number;
    dampingRatio?: number;
    clamp?: { min?: number; max?: number };
  }
  export interface WithDecayConfig {
    deceleration?: number;
    velocity?: number;
    clamp?: [min: number, max: number] | readonly [number, number];
    velocityFactor?: number;
    rubberBandEffect?: boolean;
    rubberBandFactor?: number;
    reduceMotion?: ReduceMotion;
  }
  export function withTiming<T extends AnimatableValue>(toValue: T, config?: WithTimingConfig, callback?: AnimationCallback): T;
  export function withSpring<T extends AnimatableValue>(toValue: T, config?: WithSpringConfig, callback?: AnimationCallback): T;
  export function withDecay(config: WithDecayConfig, callback?: AnimationCallback): number;
  export function withDelay<T extends AnimatableValue>(delayMs: number, delayedAnimation: T, reduceMotion?: ReduceMotion): T;
  export function withSequence<T extends AnimatableValue>(...animations: T[]): T;
  export function withSequence<T extends AnimatableValue>(reduceMotion: ReduceMotion, ...animations: T[]): T;
  export function withRepeat<T extends AnimatableValue>(animation: T, numberOfReps?: number, reverse?: boolean, callback?: AnimationCallback, reduceMotion?: ReduceMotion): T;
  export function cancelAnimation<T>(sharedValue: SharedValue<T>): void;

  export enum Extrapolation {
    IDENTITY = 'identity',
    CLAMP = 'clamp',
    EXTEND = 'extend',
  }
  export type ExtrapolationType =
    | Extrapolation
    | 'identity'
    | 'clamp'
    | 'extend'
    | { extrapolateLeft?: Extrapolation | 'identity' | 'clamp' | 'extend'; extrapolateRight?: Extrapolation | 'identity' | 'clamp' | 'extend' }
    | undefined;
  export function interpolate(x: number, input: readonly number[], output: readonly number[], type?: ExtrapolationType): number;
  export function interpolateColor(value: number, inputRange: readonly number[], outputRange: readonly (string | number)[], colorSpace?: 'RGB' | 'HSV' | 'LAB', options?: object): string | number;
  export function clamp(value: number, min: number, max: number): number;

  /** @deprecated in Reanimated 4 (moved to react-native-worklets as scheduleOnRN), still exported. */
  export function runOnJS<Args extends unknown[], ReturnValue>(fn: (...args: Args) => ReturnValue): (...args: Args) => void;
  export function runOnUI<Args extends unknown[], ReturnValue>(worklet: (...args: Args) => ReturnValue): (...args: Args) => void;

  // ---------- layout animations ----------
  export interface LayoutAnimationBuilder {
    duration(ms: number): this;
    delay(ms: number): this;
    easing(easing: EasingFunction | EasingFunctionFactory): this;
    springify(duration?: number): this;
    damping(v: number): this;
    stiffness(v: number): this;
    mass(v: number): this;
    dampingRatio(v: number): this;
    overshootClamping(v: number | boolean): this;
    restDisplacementThreshold(v: number): this;
    restSpeedThreshold(v: number): this;
    withInitialValues(values: { [key: string]: any }): this;
    withCallback(callback: (finished: boolean) => void): this;
    reduceMotion(reduceMotion: ReduceMotion): this;
    randomDelay(): this;
    build(): any;
  }
  interface LayoutAnimationBuilderStatic<T extends LayoutAnimationBuilder = LayoutAnimationBuilder> {
    new (): T;
    duration(ms: number): T;
    delay(ms: number): T;
    easing(easing: EasingFunction | EasingFunctionFactory): T;
    springify(duration?: number): T;
    damping(v: number): T;
    stiffness(v: number): T;
    mass(v: number): T;
    withInitialValues(values: { [key: string]: any }): T;
    withCallback(callback: (finished: boolean) => void): T;
    reduceMotion(reduceMotion: ReduceMotion): T;
  }
  export type EntryExitAnimationFunction = (values: any) => any;
  export type LayoutAnimationFunction = (values: any) => any;
  export type EntryOrExitLayoutType = LayoutAnimationBuilder | LayoutAnimationBuilderStatic | EntryExitAnimationFunction;
  export type LayoutTransitionType = LayoutAnimationBuilder | LayoutAnimationBuilderStatic | LayoutAnimationFunction;
  export const FadeIn: LayoutAnimationBuilderStatic;
  export const FadeInDown: LayoutAnimationBuilderStatic;
  export const FadeInUp: LayoutAnimationBuilderStatic;
  export const FadeInLeft: LayoutAnimationBuilderStatic;
  export const FadeInRight: LayoutAnimationBuilderStatic;
  export const FadeOut: LayoutAnimationBuilderStatic;
  export const FadeOutDown: LayoutAnimationBuilderStatic;
  export const FadeOutUp: LayoutAnimationBuilderStatic;
  export const ZoomIn: LayoutAnimationBuilderStatic;
  export const ZoomOut: LayoutAnimationBuilderStatic;
  export const SlideInDown: LayoutAnimationBuilderStatic;
  export const SlideInUp: LayoutAnimationBuilderStatic;
  export const SlideOutDown: LayoutAnimationBuilderStatic;
  export const SlideOutUp: LayoutAnimationBuilderStatic;
  export const LinearTransition: LayoutAnimationBuilderStatic;
  export const Layout: LayoutAnimationBuilderStatic;
  export const FadingTransition: LayoutAnimationBuilderStatic;
  export const SequencedTransition: LayoutAnimationBuilderStatic;

  // ---------- animated components ----------
  type AnimatedStyleProp = any;
  type AnimatedLayoutProps = {
    entering?: EntryOrExitLayoutType | undefined;
    exiting?: EntryOrExitLayoutType | undefined;
    layout?: LayoutTransitionType | undefined;
    animatedProps?: object | undefined;
    sharedTransitionTag?: string | undefined;
  };
  export type AnimatedProps<P> = { [K in keyof P]: K extends 'style' | 'contentContainerStyle' ? AnimatedStyleProp : P[K] } & AnimatedLayoutProps;
  export type AnimatedComponent<C extends ComponentType<any>> = ComponentType<AnimatedProps<ComponentProps<C>> & RefAttributes<any>>;
  export function createAnimatedComponent<C extends ComponentType<any>>(component: C): AnimatedComponent<C>;
  export interface AnimatedFlatListProps<T> extends AnimatedProps<FlatListProps<T>> {
    itemLayoutAnimation?: LayoutTransitionType | undefined;
    skipEnteringExitingAnimations?: boolean | undefined;
  }

  const Animated: {
    View: AnimatedComponent<typeof RNView>;
    Text: AnimatedComponent<typeof RNText>;
    Image: AnimatedComponent<typeof RNImage>;
    ScrollView: AnimatedComponent<typeof RNScrollView>;
    FlatList: <T>(props: AnimatedFlatListProps<T> & RefAttributes<any>) => ReactNode;
    createAnimatedComponent: typeof createAnimatedComponent;
  };
  namespace Animated {
    type View = RNView;
    type ScrollView = RNScrollView;
    type FlatList<T = any> = RNFlatList<T>;
  }
  export default Animated;
}

declare module 'react-native-worklets' {
  export function scheduleOnRN<Args extends unknown[], ReturnValue>(fn: (...args: Args) => ReturnValue, ...args: Args): void;
  export function scheduleOnUI<Args extends unknown[], ReturnValue>(worklet: (...args: Args) => ReturnValue, ...args: Args): void;
  export function runOnJS<Args extends unknown[], ReturnValue>(fn: (...args: Args) => ReturnValue): (...args: Args) => void;
  export function runOnUI<Args extends unknown[], ReturnValue>(worklet: (...args: Args) => ReturnValue): (...args: Args) => void;
}

declare module 'react-native-gesture-handler' {
  import type { ComponentType, ReactNode, ReactElement } from 'react';
  import type { ViewProps, StyleProp, ViewStyle } from 'react-native';

  export const GestureHandlerRootView: ComponentType<ViewProps & { unstable_forceActive?: boolean }>;

  export interface GestureEventPayload {
    handlerTag: number;
    numberOfPointers: number;
    state: number;
    pointerType: number;
  }
  export interface PanGestureHandlerEventPayload {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
    translationX: number;
    translationY: number;
    velocityX: number;
    velocityY: number;
    stylusData?: object;
  }
  export interface PinchGestureHandlerEventPayload {
    scale: number;
    focalX: number;
    focalY: number;
    velocity: number;
  }
  export interface TapGestureHandlerEventPayload {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
  }
  export type GestureUpdateEvent<T = Record<string, unknown>> = GestureEventPayload & T;
  export type GestureStateChangeEvent<T = Record<string, unknown>> = GestureEventPayload & T & { oldState: number };
  export type GestureTouchEvent = GestureEventPayload & { eventType: number; allTouches: any[]; changedTouches: any[] };

  interface BaseGesture<T> {
    onBegin(cb: (event: GestureStateChangeEvent<T>) => void): this;
    onStart(cb: (event: GestureStateChangeEvent<T>) => void): this;
    onEnd(cb: (event: GestureStateChangeEvent<T>, success: boolean) => void): this;
    onFinalize(cb: (event: GestureStateChangeEvent<T>, success: boolean) => void): this;
    onUpdate(cb: (event: GestureUpdateEvent<T>) => void): this;
    onChange(cb: (event: GestureUpdateEvent<T & { [k: string]: number }>) => void): this;
    onTouchesDown(cb: (event: GestureTouchEvent, manager: any) => void): this;
    onTouchesMove(cb: (event: GestureTouchEvent, manager: any) => void): this;
    onTouchesUp(cb: (event: GestureTouchEvent, manager: any) => void): this;
    onTouchesCancelled(cb: (event: GestureTouchEvent, manager: any) => void): this;
    enabled(enabled: boolean): this;
    shouldCancelWhenOutside(value: boolean): this;
    hitSlop(hitSlop: number | { [k: string]: number }): this;
    runOnJS(runOnJS: boolean): this;
    simultaneousWithExternalGesture(...gestures: any[]): this;
    requireExternalGestureToFail(...gestures: any[]): this;
    blocksExternalGesture(...gestures: any[]): this;
    withTestId(id: string): this;
    cancelsTouchesInView(value: boolean): this;
    manualActivation(manualActivation: boolean): this;
  }
  export interface PanGesture extends BaseGesture<PanGestureHandlerEventPayload> {
    activeOffsetX(offset: number | number[]): this;
    activeOffsetY(offset: number | number[]): this;
    failOffsetX(offset: number | number[]): this;
    failOffsetY(offset: number | number[]): this;
    minDistance(distance: number): this;
    minPointers(minPointers: number): this;
    maxPointers(maxPointers: number): this;
    minVelocity(velocity: number): this;
    averageTouches(value: boolean): this;
    enableTrackpadTwoFingerGesture(value: boolean): this;
    activateAfterLongPress(duration: number): this;
  }
  export interface PinchGesture extends BaseGesture<PinchGestureHandlerEventPayload> {}
  export interface TapGesture extends BaseGesture<TapGestureHandlerEventPayload> {
    numberOfTaps(count: number): this;
    maxDuration(duration: number): this;
    minPointers(minPointers: number): this;
    maxDistance(distance: number): this;
  }
  export interface LongPressGesture extends BaseGesture<TapGestureHandlerEventPayload & { duration: number }> {
    minDuration(duration: number): this;
    maxDistance(distance: number): this;
  }
  export type GestureType = BaseGesture<any>;
  export interface ComposedGesture {
    readonly __composed: true;
  }
  export type GestureLike = GestureType | ComposedGesture;
  export const Gesture: {
    Pan(): PanGesture;
    Pinch(): PinchGesture;
    Tap(): TapGesture;
    LongPress(): LongPressGesture;
    Rotation(): BaseGesture<{ rotation: number; anchorX: number; anchorY: number; velocity: number }>;
    Fling(): BaseGesture<{ x: number; y: number; absoluteX: number; absoluteY: number }>;
    Native(): BaseGesture<{}>;
    Manual(): BaseGesture<{}>;
    Hover(): BaseGesture<{ x: number; y: number }>;
    Race(...gestures: GestureLike[]): ComposedGesture;
    Simultaneous(...gestures: GestureLike[]): ComposedGesture;
    Exclusive(...gestures: GestureLike[]): ComposedGesture;
  };
  export interface GestureDetectorProps {
    gesture: GestureLike;
    userSelect?: 'none' | 'auto' | 'text';
    enableContextMenu?: boolean;
    touchAction?: string;
    children?: ReactNode;
  }
  export const GestureDetector: (props: GestureDetectorProps) => ReactElement | null;
  export const ScrollView: ComponentType<any>;
  export const FlatList: ComponentType<any>;
  export type SwipeableProps = { [k: string]: any; children?: ReactNode; containerStyle?: StyleProp<ViewStyle> };
}
