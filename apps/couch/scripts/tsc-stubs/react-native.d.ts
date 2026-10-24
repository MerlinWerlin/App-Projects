// Offline type stubs for react-native 0.83 (oversight D75-1). Only the APIs Couch uses.
// Props keep an index signature so uncommon props pass; the commonly used ones are typed
// so callbacks, styles and refs are checked. The real types on the PC remain the authority.

declare module 'react-native' {
  import type { Component, ComponentType, ReactNode, RefObject, Ref } from 'react';

  type Loose = { [key: string]: any };

  export type ColorValue = string;
  export type DimensionValue = number | `${number}%` | 'auto' | null;
  // Style keys are listed so misspelt keys fail; values stay loose (the real types check them on the PC).
  export interface ViewStyle {
    display?: any;
    width?: any;
    height?: any;
    minWidth?: any;
    maxWidth?: any;
    minHeight?: any;
    maxHeight?: any;
    flex?: any;
    flexGrow?: any;
    flexShrink?: any;
    flexBasis?: any;
    flexDirection?: any;
    flexWrap?: any;
    alignItems?: any;
    alignSelf?: any;
    alignContent?: any;
    justifyContent?: any;
    position?: any;
    top?: any;
    bottom?: any;
    left?: any;
    right?: any;
    start?: any;
    end?: any;
    inset?: any;
    insetBlock?: any;
    insetInline?: any;
    margin?: any;
    marginTop?: any;
    marginBottom?: any;
    marginLeft?: any;
    marginRight?: any;
    marginHorizontal?: any;
    marginVertical?: any;
    marginStart?: any;
    marginEnd?: any;
    marginBlock?: any;
    marginInline?: any;
    padding?: any;
    paddingTop?: any;
    paddingBottom?: any;
    paddingLeft?: any;
    paddingRight?: any;
    paddingHorizontal?: any;
    paddingVertical?: any;
    paddingStart?: any;
    paddingEnd?: any;
    paddingBlock?: any;
    paddingInline?: any;
    gap?: any;
    rowGap?: any;
    columnGap?: any;
    overflow?: any;
    zIndex?: any;
    direction?: any;
    aspectRatio?: any;
    boxSizing?: any;
    backgroundColor?: any;
    opacity?: any;
    borderWidth?: any;
    borderTopWidth?: any;
    borderBottomWidth?: any;
    borderLeftWidth?: any;
    borderRightWidth?: any;
    borderStartWidth?: any;
    borderEndWidth?: any;
    borderColor?: any;
    borderTopColor?: any;
    borderBottomColor?: any;
    borderLeftColor?: any;
    borderRightColor?: any;
    borderStartColor?: any;
    borderEndColor?: any;
    borderRadius?: any;
    borderTopLeftRadius?: any;
    borderTopRightRadius?: any;
    borderBottomLeftRadius?: any;
    borderBottomRightRadius?: any;
    borderTopStartRadius?: any;
    borderTopEndRadius?: any;
    borderBottomStartRadius?: any;
    borderBottomEndRadius?: any;
    borderCurve?: any;
    borderStyle?: any;
    shadowColor?: any;
    shadowOffset?: any;
    shadowOpacity?: any;
    shadowRadius?: any;
    elevation?: any;
    transform?: any;
    transformOrigin?: any;
    backfaceVisibility?: any;
    pointerEvents?: any;
    boxShadow?: any;
    filter?: any;
    mixBlendMode?: any;
    isolation?: any;
    outlineColor?: any;
    outlineOffset?: any;
    outlineStyle?: any;
    outlineWidth?: any;
    cursor?: any;
    experimental_backgroundImage?: any;
    tintColor?: any;
    overlayColor?: any;
    resizeMode?: any;
    objectFit?: any;
  }
  export interface TextStyle extends ViewStyle {
    color?: any;
    fontFamily?: any;
    fontSize?: any;
    fontStyle?: any;
    fontWeight?: any;
    fontVariant?: any;
    letterSpacing?: any;
    lineHeight?: any;
    textAlign?: any;
    textAlignVertical?: any;
    textDecorationLine?: any;
    textDecorationStyle?: any;
    textDecorationColor?: any;
    textShadowColor?: any;
    textShadowOffset?: any;
    textShadowRadius?: any;
    textTransform?: any;
    includeFontPadding?: any;
    verticalAlign?: any;
    writingDirection?: any;
    userSelect?: any;
  }
  export interface ImageStyle extends ViewStyle {}
  export type RegisteredStyle<T> = number & { __registered?: T };
  type Falsy = false | null | undefined | '' | 0;
  export type StyleProp<T> = T | RegisteredStyle<T> | Falsy | ReadonlyArray<StyleProp<T>>;

  export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
    currentTarget: any;
    target: any;
    preventDefault(): void;
    stopPropagation(): void;
    persist(): void;
  }
  export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;
  export interface NativeTouchEvent {
    locationX: number;
    locationY: number;
    pageX: number;
    pageY: number;
    timestamp: number;
    identifier: string;
    touches: NativeTouchEvent[];
    changedTouches: NativeTouchEvent[];
  }
  export type GestureResponderEvent = NativeSyntheticEvent<NativeTouchEvent>;
  export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
    contentInset: { top: number; left: number; bottom: number; right: number };
    zoomScale: number;
  }

  export type AccessibilityRole =
    | 'none' | 'button' | 'togglebutton' | 'link' | 'search' | 'image' | 'keyboardkey' | 'text'
    | 'adjustable' | 'imagebutton' | 'header' | 'summary' | 'alert' | 'checkbox' | 'combobox'
    | 'menu' | 'menubar' | 'menuitem' | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar'
    | 'spinbutton' | 'switch' | 'tab' | 'tabbar' | 'tablist' | 'timer' | 'list' | 'toolbar'
    | 'grid' | 'pager' | 'scrollview' | 'horizontalscrollview' | 'viewgroup' | 'webview'
    | 'drawerlayout' | 'slidingdrawer' | 'iconmenu' | string;
  export interface AccessibilityState {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  }
  export interface AccessibilityActionInfo {
    name: string;
    label?: string;
  }
  export type AccessibilityActionEvent = NativeSyntheticEvent<{ actionName: string }>;
  export interface Insets {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  }

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    testID?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    onLayout?: (event: LayoutChangeEvent) => void;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: AccessibilityState;
    accessibilityActions?: ReadonlyArray<AccessibilityActionInfo>;
    onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
    accessibilityElementsHidden?: boolean;
    hitSlop?: number | Insets | null;
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
    accessibilityViewIsModal?: boolean;
    accessibilityIgnoresInvertColors?: boolean;
    accessibilityLanguage?: string;
    accessibilityValue?: { min?: number; max?: number; now?: number; text?: string };
    onAccessibilityTap?: () => void;
    onAccessibilityEscape?: () => void;
    onMagicTap?: () => void;
    nativeID?: string;
    collapsable?: boolean;
    focusable?: boolean;
    needsOffscreenAlphaCompositing?: boolean;
    renderToHardwareTextureAndroid?: boolean;
    shouldRasterizeIOS?: boolean;
    onTouchStart?: (e: GestureResponderEvent) => void;
    onTouchMove?: (e: GestureResponderEvent) => void;
    onTouchEnd?: (e: GestureResponderEvent) => void;
    onTouchCancel?: (e: GestureResponderEvent) => void;
    onStartShouldSetResponder?: (e: GestureResponderEvent) => boolean;
    onMoveShouldSetResponder?: (e: GestureResponderEvent) => boolean;
    onResponderGrant?: (e: GestureResponderEvent) => void;
    onResponderMove?: (e: GestureResponderEvent) => void;
    onResponderRelease?: (e: GestureResponderEvent) => void;
    onResponderTerminate?: (e: GestureResponderEvent) => void;
    onResponderTerminationRequest?: (e: GestureResponderEvent) => boolean;
  }
  export interface TextProps extends ViewProps {
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number | null;
    adjustsFontSizeToFit?: boolean;
    selectable?: boolean;
    onPress?: (event: GestureResponderEvent) => void;
    onLongPress?: (event: GestureResponderEvent) => void;
    minimumFontScale?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    textBreakStrategy?: 'simple' | 'highQuality' | 'balanced';
    lineBreakStrategyIOS?: 'none' | 'standard' | 'hangul-word' | 'push-out';
    android_hyphenationFrequency?: 'none' | 'normal' | 'full';
    dataDetectorType?: string;
    suppressHighlighting?: boolean;
  }
  export interface PressableStateCallbackType {
    readonly pressed: boolean;
    readonly hovered?: boolean;
    readonly focused?: boolean;
  }
  export interface PressableProps extends Omit<ViewProps, 'style' | 'children'> {
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
    onPress?: ((event: GestureResponderEvent) => void) | null;
    onPressIn?: ((event: GestureResponderEvent) => void) | null;
    onPressOut?: ((event: GestureResponderEvent) => void) | null;
    onLongPress?: ((event: GestureResponderEvent) => void) | null;
    delayLongPress?: number;
    disabled?: boolean | null;
  }
  export interface TextInputProps extends TextProps {
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    placeholderTextColor?: ColorValue;
    textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
    onChangeText?: (text: string) => void;
    onSubmitEditing?: (e: NativeSyntheticEvent<{ text: string }>) => void;
    onKeyPress?: (e: NativeSyntheticEvent<{ key: string }>) => void;
    autoFocus?: boolean;
    keyboardType?: string;
    returnKeyType?: string;
    secureTextEntry?: boolean;
    multiline?: boolean;
    editable?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    autoComplete?: string;
    maxLength?: number;
    selectionColor?: ColorValue;
    cursorColor?: ColorValue;
    textContentType?: string;
    inputMode?: string;
    keyboardAppearance?: 'default' | 'light' | 'dark';
    enablesReturnKeyAutomatically?: boolean;
    blurOnSubmit?: boolean;
    submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
    caretHidden?: boolean;
    clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always';
    spellCheck?: boolean;
    selectTextOnFocus?: boolean;
    contextMenuHidden?: boolean;
    onFocus?: (e: NativeSyntheticEvent<any>) => void;
    onBlur?: (e: NativeSyntheticEvent<any>) => void;
  }
  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    horizontal?: boolean | null;
    onScroll?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | any;
    scrollEventThrottle?: number;
    refreshControl?: ReactNode;
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
    scrollEnabled?: boolean;
    bounces?: boolean;
    alwaysBounceVertical?: boolean;
    alwaysBounceHorizontal?: boolean;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    scrollIndicatorInsets?: Insets;
    contentInset?: Insets;
    contentOffset?: { x: number; y: number };
    contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
    automaticallyAdjustKeyboardInsets?: boolean;
    keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
    nestedScrollEnabled?: boolean;
    pagingEnabled?: boolean;
    decelerationRate?: 'fast' | 'normal' | number;
    snapToInterval?: number;
    snapToAlignment?: 'start' | 'center' | 'end';
    stickyHeaderIndices?: number[];
    overScrollMode?: 'auto' | 'always' | 'never';
    onContentSizeChange?: (w: number, h: number) => void;
    onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  }
  export interface RefreshControlProps extends ViewProps {
    refreshing: boolean;
    onRefresh?: () => void;
    tintColor?: ColorValue;
  }
  export interface ModalProps extends ViewProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    statusBarTranslucent?: boolean;
  }
  export interface SwitchProps extends ViewProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    trackColor?: { false?: ColorValue | null; true?: ColorValue | null };
    thumbColor?: ColorValue;
    ios_backgroundColor?: ColorValue;
  }
  export interface ImageProps extends ViewProps {
    source: { uri: string; headers?: Record<string, string> } | number;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    onLoad?: (e: any) => void;
    onError?: (e: any) => void;
    fadeDuration?: number;
  }
  export interface ActivityIndicatorProps extends ViewProps {
    size?: 'small' | 'large' | number;
    color?: ColorValue;
    animating?: boolean;
  }
  export interface KeyboardAvoidingViewProps extends ViewProps {
    behavior?: 'height' | 'position' | 'padding';
    keyboardVerticalOffset?: number;
  }

  interface Measurable {
    measure(cb: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void): void;
    measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void;
  }
  export class View extends Component<ViewProps> {}
  export interface View extends Measurable {}
  export class Text extends Component<TextProps> {}
  export interface Text extends Measurable {}
  export class TextInput extends Component<TextInputProps> {
    focus(): void;
    blur(): void;
    clear(): void;
    isFocused(): boolean;
  }
  export class ScrollView extends Component<ScrollViewProps> {
    scrollTo(opts?: { x?: number; y?: number; animated?: boolean }): void;
    scrollToEnd(opts?: { animated?: boolean }): void;
  }
  export class Pressable extends Component<PressableProps> {}
  export interface Pressable extends Measurable {}
  export class Modal extends Component<ModalProps> {}
  export class Switch extends Component<SwitchProps> {}
  export class Image extends Component<ImageProps> {
    static prefetch(url: string): Promise<boolean>;
  }
  export class ActivityIndicator extends Component<ActivityIndicatorProps> {}
  export class KeyboardAvoidingView extends Component<KeyboardAvoidingViewProps> {}
  export class RefreshControl extends Component<RefreshControlProps> {}
  export class TouchableOpacity extends Component<PressableProps & { activeOpacity?: number }> {}

  type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
  export const StyleSheet: {
    create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T & NamedStyles<any>): T;
    flatten<T>(style?: StyleProp<T>): T;
    compose<T>(a: StyleProp<T>, b: StyleProp<T>): StyleProp<T>;
    readonly hairlineWidth: number;
    readonly absoluteFill: ViewStyle;
    readonly absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  };

  export type EasingFunction = (value: number) => number;
  export const Easing: {
    linear: EasingFunction;
    ease: EasingFunction;
    quad: EasingFunction;
    cubic: EasingFunction;
    sin: EasingFunction;
    circle: EasingFunction;
    exp: EasingFunction;
    bounce: EasingFunction;
    poly(n: number): EasingFunction;
    elastic(bounciness?: number): EasingFunction;
    back(s?: number): EasingFunction;
    bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
    in(easing: EasingFunction): EasingFunction;
    out(easing: EasingFunction): EasingFunction;
    inOut(easing: EasingFunction): EasingFunction;
  };

  export namespace Animated {
    type EndResult = { finished: boolean };
    type EndCallback = (result: EndResult) => void;
    interface CompositeAnimation {
      start(callback?: EndCallback): void;
      stop(): void;
      reset(): void;
    }
    interface InterpolationConfig {
      inputRange: readonly number[];
      outputRange: readonly number[] | readonly string[];
      easing?: EasingFunction;
      extrapolate?: 'extend' | 'identity' | 'clamp';
      extrapolateLeft?: 'extend' | 'identity' | 'clamp';
      extrapolateRight?: 'extend' | 'identity' | 'clamp';
    }
    class AnimatedNode {
      interpolate(config: InterpolationConfig): AnimatedInterpolation;
    }
    class AnimatedInterpolation extends AnimatedNode {}
    class Value extends AnimatedNode {
      constructor(value: number, config?: { useNativeDriver?: boolean });
      setValue(value: number): void;
      setOffset(offset: number): void;
      flattenOffset(): void;
      stopAnimation(cb?: (value: number) => void): void;
      resetAnimation(cb?: (value: number) => void): void;
      addListener(cb: (state: { value: number }) => void): string;
      removeListener(id: string): void;
      removeAllListeners(): void;
    }
    class ValueXY extends AnimatedNode {
      constructor(value?: { x: number; y: number });
      x: Value;
      y: Value;
      setValue(value: { x: number; y: number }): void;
      getLayout(): { left: Value; top: Value };
      getTranslateTransform(): Array<{ translateX: Value } | { translateY: Value }>;
    }
    type Animatable = Value | ValueXY | AnimatedInterpolation;
    interface AnimationConfig {
      useNativeDriver: boolean;
      isInteraction?: boolean;
      delay?: number;
    }
    interface TimingConfig extends AnimationConfig {
      toValue: number | Value | { x: number; y: number };
      duration?: number;
      easing?: EasingFunction;
    }
    interface SpringConfig extends AnimationConfig {
      toValue: number | Value | { x: number; y: number };
      friction?: number;
      tension?: number;
      speed?: number;
      bounciness?: number;
      stiffness?: number;
      damping?: number;
      mass?: number;
      velocity?: number;
      overshootClamping?: boolean;
      restDisplacementThreshold?: number;
      restSpeedThreshold?: number;
    }
    function timing(value: Value | ValueXY, config: TimingConfig): CompositeAnimation;
    function spring(value: Value | ValueXY, config: SpringConfig): CompositeAnimation;
    function decay(value: Value | ValueXY, config: AnimationConfig & { velocity: number; deceleration?: number }): CompositeAnimation;
    function sequence(animations: CompositeAnimation[]): CompositeAnimation;
    function parallel(animations: CompositeAnimation[], config?: { stopTogether?: boolean }): CompositeAnimation;
    function stagger(time: number, animations: CompositeAnimation[]): CompositeAnimation;
    function delay(time: number): CompositeAnimation;
    function loop(animation: CompositeAnimation, config?: { iterations?: number; resetBeforeIteration?: boolean }): CompositeAnimation;
    function add(a: Animatable | number, b: Animatable | number): AnimatedInterpolation;
    function multiply(a: Animatable | number, b: Animatable | number): AnimatedInterpolation;
    function diffClamp(a: Animatable, min: number, max: number): AnimatedInterpolation;
    function event(mapping: any[], config?: { useNativeDriver: boolean; listener?: (...args: any[]) => void }): (...args: any[]) => void;
    function createAnimatedComponent<T extends ComponentType<any>>(component: T): ComponentType<any>;
    const View: ComponentType<ViewProps>;
    const Text: ComponentType<TextProps>;
    const Image: ComponentType<ImageProps>;
    const ScrollView: ComponentType<ScrollViewProps>;
  }

  export const Platform: {
    OS: 'ios' | 'android' | 'web' | 'windows' | 'macos';
    Version: number | string;
    isPad?: boolean;
    constants: { [key: string]: unknown };
    select<T>(specifics: { ios?: T; android?: T; web?: T; native?: T; default?: T }): T;
  };

  export const I18nManager: {
    isRTL: boolean;
    allowRTL(allow: boolean): void;
    forceRTL(force: boolean): void;
    swapLeftAndRightInRTL(swap: boolean): void;
    getConstants(): { isRTL: boolean; doLeftAndRightSwapInRTL: boolean };
  };

  export const PixelRatio: {
    get(): number;
    getFontScale(): number;
    getPixelSizeForLayoutSize(size: number): number;
    roundToNearestPixel(size: number): number;
  };

  export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  export interface EmitterSubscription {
    remove(): void;
  }
  export const AppState: {
    currentState: AppStateStatus;
    addEventListener(type: 'change' | 'memoryWarning' | 'focus' | 'blur', listener: (state: AppStateStatus) => void): EmitterSubscription;
  };

  export const AccessibilityInfo: {
    isReduceMotionEnabled(): Promise<boolean>;
    isReduceTransparencyEnabled(): Promise<boolean>;
    isScreenReaderEnabled(): Promise<boolean>;
    isBoldTextEnabled(): Promise<boolean>;
    announceForAccessibility(message: string): void;
    setAccessibilityFocus(tag: number): void;
    addEventListener(
      event: 'reduceMotionChanged' | 'reduceTransparencyChanged' | 'screenReaderChanged' | 'boldTextChanged' | 'announcementFinished',
      handler: (value: any) => void,
    ): EmitterSubscription;
  };

  export interface AlertButton {
    text?: string;
    onPress?: (value?: string) => void;
    style?: 'default' | 'cancel' | 'destructive';
    isPreferred?: boolean;
  }
  export const Alert: {
    alert(title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean; onDismiss?: () => void }): void;
  };

  export const Share: {
    share(content: { message?: string; url?: string; title?: string }, options?: { dialogTitle?: string; subject?: string }): Promise<{ action: string; activityType?: string | null }>;
    sharedAction: 'sharedAction';
    dismissedAction: 'dismissedAction';
  };

  export interface PanResponderGestureState {
    stateID: number;
    moveX: number;
    moveY: number;
    x0: number;
    y0: number;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
    numberActiveTouches: number;
  }
  type PanHandler = (e: GestureResponderEvent, g: PanResponderGestureState) => void;
  type PanPredicate = (e: GestureResponderEvent, g: PanResponderGestureState) => boolean;
  export interface PanResponderCallbacks {
    onStartShouldSetPanResponder?: PanPredicate;
    onStartShouldSetPanResponderCapture?: PanPredicate;
    onMoveShouldSetPanResponder?: PanPredicate;
    onMoveShouldSetPanResponderCapture?: PanPredicate;
    onPanResponderGrant?: PanHandler;
    onPanResponderMove?: PanHandler;
    onPanResponderRelease?: PanHandler;
    onPanResponderTerminate?: PanHandler;
    onPanResponderTerminationRequest?: PanPredicate;
    onShouldBlockNativeResponder?: PanPredicate;
  }
  export interface PanResponderInstance {
    panHandlers: Loose;
  }
  export const PanResponder: {
    create(config: PanResponderCallbacks): PanResponderInstance;
  };

  export interface LayoutAnimationConfig {
    duration: number;
    create?: Loose;
    update?: Loose;
    delete?: Loose;
  }
  export const LayoutAnimation: {
    configureNext(config: LayoutAnimationConfig, onEnd?: () => void, onFail?: () => void): void;
    create(duration: number, type?: string, property?: string): LayoutAnimationConfig;
    Types: { spring: 'spring'; linear: 'linear'; easeInEaseOut: 'easeInEaseOut'; easeIn: 'easeIn'; easeOut: 'easeOut'; keyboard: 'keyboard' };
    Properties: { opacity: 'opacity'; scaleX: 'scaleX'; scaleY: 'scaleY'; scaleXY: 'scaleXY' };
    Presets: { easeInEaseOut: LayoutAnimationConfig; linear: LayoutAnimationConfig; spring: LayoutAnimationConfig };
  };

  export const UIManager: {
    setLayoutAnimationEnabledExperimental?: (enabled: boolean) => void;
    [key: string]: any;
  };

  export const Linking: {
    openURL(url: string): Promise<void>;
    canOpenURL(url: string): Promise<boolean>;
    openSettings(): Promise<void>;
    getInitialURL(): Promise<string | null>;
    addEventListener(type: 'url', handler: (event: { url: string }) => void): EmitterSubscription;
  };

  export const Dimensions: {
    get(dim: 'window' | 'screen'): { width: number; height: number; scale: number; fontScale: number };
  };
  export function useWindowDimensions(): { width: number; height: number; scale: number; fontScale: number };
  export function useColorScheme(): 'light' | 'dark' | null | undefined;
  export const NativeModules: Loose;
  export const Vibration: { vibrate(pattern?: number | number[]): void; cancel(): void };
  export const Keyboard: { dismiss(): void; addListener(event: string, cb: (e: any) => void): EmitterSubscription };
}
