// Hand-written approximation of react-native 0.81 types for the cloud strict-tsc harness (D74-3).
// Covers the components and APIs Glaze imports, with the real public prop names and types.

declare module 'react-native' {
  import type { Component, ReactNode, Ref, ComponentType, ReactElement } from 'react';

  // ---------- styles ----------
  export type ColorValue = string | OpaqueColorValue;
  export type OpaqueColorValue = symbol & { __TYPE__: 'Color' };
  export type DimensionValue = number | 'auto' | `${number}%` | Animated.AnimatedNode | null;
  type AnimatableNumericValue = number | Animated.AnimatedNode;
  type AnimatableStringValue = string | Animated.AnimatedNode;

  export type FlexAlignType = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  export interface FlexStyle {
    alignContent?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly' | undefined;
    alignItems?: FlexAlignType | undefined;
    alignSelf?: 'auto' | FlexAlignType | undefined;
    aspectRatio?: number | string | undefined;
    borderBottomWidth?: number | undefined;
    borderEndWidth?: number | undefined;
    borderLeftWidth?: number | undefined;
    borderRightWidth?: number | undefined;
    borderStartWidth?: number | undefined;
    borderTopWidth?: number | undefined;
    borderWidth?: number | undefined;
    bottom?: DimensionValue | undefined;
    boxSizing?: 'border-box' | 'content-box' | undefined;
    display?: 'none' | 'flex' | 'contents' | undefined;
    end?: DimensionValue | undefined;
    flex?: number | undefined;
    flexBasis?: DimensionValue | undefined;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse' | undefined;
    rowGap?: number | string | undefined;
    gap?: number | string | undefined;
    columnGap?: number | string | undefined;
    flexGrow?: number | undefined;
    flexShrink?: number | undefined;
    flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse' | undefined;
    height?: DimensionValue | undefined;
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | undefined;
    left?: DimensionValue | undefined;
    margin?: DimensionValue | undefined;
    marginBottom?: DimensionValue | undefined;
    marginEnd?: DimensionValue | undefined;
    marginHorizontal?: DimensionValue | undefined;
    marginLeft?: DimensionValue | undefined;
    marginRight?: DimensionValue | undefined;
    marginStart?: DimensionValue | undefined;
    marginTop?: DimensionValue | undefined;
    marginVertical?: DimensionValue | undefined;
    marginBlock?: DimensionValue | undefined;
    marginInline?: DimensionValue | undefined;
    maxHeight?: DimensionValue | undefined;
    maxWidth?: DimensionValue | undefined;
    minHeight?: DimensionValue | undefined;
    minWidth?: DimensionValue | undefined;
    overflow?: 'visible' | 'hidden' | 'scroll' | undefined;
    padding?: DimensionValue | undefined;
    paddingBottom?: DimensionValue | undefined;
    paddingEnd?: DimensionValue | undefined;
    paddingHorizontal?: DimensionValue | undefined;
    paddingLeft?: DimensionValue | undefined;
    paddingRight?: DimensionValue | undefined;
    paddingStart?: DimensionValue | undefined;
    paddingTop?: DimensionValue | undefined;
    paddingVertical?: DimensionValue | undefined;
    paddingBlock?: DimensionValue | undefined;
    paddingInline?: DimensionValue | undefined;
    position?: 'absolute' | 'relative' | 'static' | undefined;
    right?: DimensionValue | undefined;
    start?: DimensionValue | undefined;
    top?: DimensionValue | undefined;
    inset?: DimensionValue | undefined;
    insetBlock?: DimensionValue | undefined;
    insetInline?: DimensionValue | undefined;
    width?: DimensionValue | undefined;
    zIndex?: number | undefined;
    direction?: 'inherit' | 'ltr' | 'rtl' | undefined;
  }

  export type TransformsStyle = {
    transform?:
      | ReadonlyArray<
          | { perspective: AnimatableNumericValue }
          | { rotate: AnimatableStringValue }
          | { rotateX: AnimatableStringValue }
          | { rotateY: AnimatableStringValue }
          | { rotateZ: AnimatableStringValue }
          | { scale: AnimatableNumericValue }
          | { scaleX: AnimatableNumericValue }
          | { scaleY: AnimatableNumericValue }
          | { translateX: AnimatableNumericValue | `${number}%` }
          | { translateY: AnimatableNumericValue | `${number}%` }
          | { skewX: AnimatableStringValue }
          | { skewY: AnimatableStringValue }
          | { matrix: AnimatableNumericValue[] }
        >
      | string
      | undefined;
    transformOrigin?: Array<string | number> | string | undefined;
  };

  export interface ShadowStyleIOS {
    shadowColor?: ColorValue | undefined;
    shadowOffset?: Readonly<{ width: number; height: number }> | undefined;
    shadowOpacity?: AnimatableNumericValue | undefined;
    shadowRadius?: number | undefined;
  }

  export type FilterFunction = { [k: string]: number | string | object };
  export interface ViewStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
    backfaceVisibility?: 'visible' | 'hidden' | undefined;
    backgroundColor?: ColorValue | undefined;
    borderBlockColor?: ColorValue | undefined;
    borderBottomColor?: ColorValue | undefined;
    borderBottomEndRadius?: AnimatableNumericValue | string | undefined;
    borderBottomLeftRadius?: AnimatableNumericValue | string | undefined;
    borderBottomRightRadius?: AnimatableNumericValue | string | undefined;
    borderBottomStartRadius?: AnimatableNumericValue | string | undefined;
    borderColor?: ColorValue | undefined;
    borderCurve?: 'circular' | 'continuous' | undefined;
    borderEndColor?: ColorValue | undefined;
    borderLeftColor?: ColorValue | undefined;
    borderRadius?: AnimatableNumericValue | string | undefined;
    borderRightColor?: ColorValue | undefined;
    borderStartColor?: ColorValue | undefined;
    borderStyle?: 'solid' | 'dotted' | 'dashed' | undefined;
    borderTopColor?: ColorValue | undefined;
    borderTopEndRadius?: AnimatableNumericValue | string | undefined;
    borderTopLeftRadius?: AnimatableNumericValue | string | undefined;
    borderTopRightRadius?: AnimatableNumericValue | string | undefined;
    borderTopStartRadius?: AnimatableNumericValue | string | undefined;
    outlineColor?: ColorValue | undefined;
    outlineOffset?: AnimatableNumericValue | undefined;
    outlineStyle?: 'solid' | 'dotted' | 'dashed' | undefined;
    outlineWidth?: AnimatableNumericValue | undefined;
    opacity?: AnimatableNumericValue | undefined;
    elevation?: number | undefined;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined;
    isolation?: 'auto' | 'isolate' | undefined;
    cursor?: 'auto' | 'pointer' | undefined;
    boxShadow?: string | ReadonlyArray<object> | undefined;
    filter?: string | ReadonlyArray<FilterFunction> | undefined;
    mixBlendMode?: string | undefined;
    experimental_backgroundImage?: string | ReadonlyArray<object> | undefined;
  }

  export type FontVariant = 'small-caps' | 'oldstyle-nums' | 'lining-nums' | 'tabular-nums' | 'common-ligatures' | 'no-common-ligatures' | 'discretionary-ligatures' | 'no-discretionary-ligatures' | 'proportional-nums' | string;
  export interface TextStyle extends ViewStyle {
    color?: ColorValue | undefined;
    fontFamily?: string | undefined;
    fontSize?: number | undefined;
    fontStyle?: 'normal' | 'italic' | undefined;
    fontWeight?:
      | 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
      | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
      | 'ultralight' | 'thin' | 'light' | 'medium' | 'regular' | 'semibold' | 'condensedBold' | 'condensed' | 'heavy' | 'black'
      | undefined;
    letterSpacing?: number | undefined;
    lineHeight?: number | undefined;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify' | undefined;
    textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center' | undefined;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through' | undefined;
    textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed' | undefined;
    textDecorationColor?: ColorValue | undefined;
    textShadowColor?: ColorValue | undefined;
    textShadowOffset?: { width: number; height: number } | undefined;
    textShadowRadius?: number | undefined;
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase' | undefined;
    userSelect?: 'auto' | 'none' | 'text' | 'contain' | 'all' | undefined;
    writingDirection?: 'auto' | 'ltr' | 'rtl' | undefined;
    fontVariant?: FontVariant[] | undefined;
    includeFontPadding?: boolean | undefined;
    verticalAlign?: 'auto' | 'top' | 'bottom' | 'middle' | undefined;
  }
  export interface ImageStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
    resizeMode?: ImageResizeMode | undefined;
    backfaceVisibility?: 'visible' | 'hidden' | undefined;
    borderBottomLeftRadius?: AnimatableNumericValue | undefined;
    borderBottomRightRadius?: AnimatableNumericValue | undefined;
    backgroundColor?: ColorValue | undefined;
    borderColor?: ColorValue | undefined;
    borderRadius?: AnimatableNumericValue | undefined;
    borderTopLeftRadius?: AnimatableNumericValue | undefined;
    borderTopRightRadius?: AnimatableNumericValue | undefined;
    borderCurve?: 'circular' | 'continuous' | undefined;
    overflow?: 'visible' | 'hidden' | undefined;
    overlayColor?: ColorValue | undefined;
    tintColor?: ColorValue | undefined;
    opacity?: AnimatableNumericValue | undefined;
    objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none' | undefined;
    cursor?: 'auto' | 'pointer' | undefined;
  }

  type Falsy = undefined | null | false | '';
  interface RecursiveArray<T> extends Array<T | ReadonlyArray<T> | RecursiveArray<T>> {}
  type RegisteredStyle<T> = number & { __registeredStyleBrand: T };
  export type StyleProp<T> = T | RegisteredStyle<T> | RecursiveArray<T | RegisteredStyle<T> | Falsy> | Falsy;

  type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
  export namespace StyleSheet {
    type AbsoluteFillStyle = {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
    function create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T & NamedStyles<any>): T;
    function flatten<T>(style?: StyleProp<T>): T;
    function compose<T extends ViewStyle | TextStyle | ImageStyle>(style1: StyleProp<T>, style2: StyleProp<T>): StyleProp<T>;
    const hairlineWidth: number;
    const absoluteFill: AbsoluteFillStyle;
    const absoluteFillObject: AbsoluteFillStyle;
  }

  // ---------- events ----------
  export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
    currentTarget: any;
    target: any;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    preventDefault(): void;
    isDefaultPrevented(): boolean;
    stopPropagation(): void;
    isPropagationStopped(): boolean;
    persist(): void;
    timeStamp: number;
    type: string;
  }
  export interface NativeTouchEvent {
    changedTouches: NativeTouchEvent[];
    identifier: string;
    locationX: number;
    locationY: number;
    pageX: number;
    pageY: number;
    target: string;
    timestamp: number;
    touches: NativeTouchEvent[];
    force?: number | undefined;
  }
  export type GestureResponderEvent = NativeSyntheticEvent<NativeTouchEvent>;
  export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;
  export interface NativeScrollPoint {
    x: number;
    y: number;
  }
  export interface NativeScrollSize {
    height: number;
    width: number;
  }
  export interface NativeScrollEvent {
    contentInset: { top: number; left: number; bottom: number; right: number };
    contentOffset: NativeScrollPoint;
    contentSize: NativeScrollSize;
    layoutMeasurement: NativeScrollSize;
    zoomScale: number;
    velocity?: NativeScrollPoint | undefined;
    targetContentOffset?: NativeScrollPoint | undefined;
  }
  export type AccessibilityActionEvent = NativeSyntheticEvent<Readonly<{ actionName: string }>>;
  export type MouseEvent = NativeSyntheticEvent<any>;

  // ---------- accessibility ----------
  export type AccessibilityRole =
    | 'none' | 'button' | 'togglebutton' | 'link' | 'search' | 'image' | 'keyboardkey' | 'text' | 'adjustable'
    | 'imagebutton' | 'header' | 'summary' | 'alert' | 'checkbox' | 'combobox' | 'menu' | 'menubar' | 'menuitem'
    | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar' | 'spinbutton' | 'switch' | 'tab' | 'tabbar' | 'tablist'
    | 'timer' | 'list' | 'grid' | 'pager' | 'scrollview' | 'horizontalscrollview' | 'viewgroup' | 'webview'
    | 'drawerlayout' | 'slidingdrawer' | 'iconmenu' | 'toolbar' | 'dropdownlist';
  export type Role = string;
  export interface AccessibilityState {
    disabled?: boolean | undefined;
    selected?: boolean | undefined;
    checked?: boolean | 'mixed' | undefined;
    busy?: boolean | undefined;
    expanded?: boolean | undefined;
  }
  export interface AccessibilityValue {
    min?: number | undefined;
    max?: number | undefined;
    now?: number | undefined;
    text?: string | undefined;
  }
  export type AccessibilityActionInfo = Readonly<{ name: string; label?: string | undefined }>;
  export interface AccessibilityProps {
    accessible?: boolean | undefined;
    accessibilityActions?: ReadonlyArray<AccessibilityActionInfo> | undefined;
    accessibilityLabel?: string | undefined;
    'aria-label'?: string | undefined;
    accessibilityRole?: AccessibilityRole | undefined;
    role?: Role | undefined;
    accessibilityState?: AccessibilityState | undefined;
    'aria-busy'?: boolean | undefined;
    'aria-checked'?: boolean | 'mixed' | undefined;
    'aria-disabled'?: boolean | undefined;
    'aria-expanded'?: boolean | undefined;
    'aria-selected'?: boolean | undefined;
    'aria-hidden'?: boolean | undefined;
    'aria-live'?: 'polite' | 'assertive' | 'off' | undefined;
    'aria-modal'?: boolean | undefined;
    'aria-valuemax'?: number | undefined;
    'aria-valuemin'?: number | undefined;
    'aria-valuenow'?: number | undefined;
    'aria-valuetext'?: string | undefined;
    'aria-labelledby'?: string | undefined;
    accessibilityHint?: string | undefined;
    accessibilityValue?: AccessibilityValue | undefined;
    onAccessibilityAction?: ((event: AccessibilityActionEvent) => void) | undefined;
    accessibilityLabelledBy?: string | string[] | undefined;
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive' | undefined;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants' | undefined;
    accessibilityElementsHidden?: boolean | undefined;
    accessibilityViewIsModal?: boolean | undefined;
    onAccessibilityEscape?: (() => void) | undefined;
    onAccessibilityTap?: (() => void) | undefined;
    onMagicTap?: (() => void) | undefined;
    accessibilityIgnoresInvertColors?: boolean | undefined;
    accessibilityLanguage?: string | undefined;
    accessibilityShowsLargeContentViewer?: boolean | undefined;
    accessibilityLargeContentTitle?: string | undefined;
  }

  export interface Insets {
    top?: number | undefined;
    left?: number | undefined;
    bottom?: number | undefined;
    right?: number | undefined;
  }

  // ---------- View ----------
  export interface ViewProps extends AccessibilityProps {
    children?: ReactNode | undefined;
    style?: StyleProp<ViewStyle> | undefined;
    hitSlop?: null | Insets | number | undefined;
    id?: string | undefined;
    nativeID?: string | undefined;
    testID?: string | undefined;
    onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined;
    removeClippedSubviews?: boolean | undefined;
    collapsable?: boolean | undefined;
    needsOffscreenAlphaCompositing?: boolean | undefined;
    renderToHardwareTextureAndroid?: boolean | undefined;
    shouldRasterizeIOS?: boolean | undefined;
    focusable?: boolean | undefined;
    tabIndex?: 0 | -1 | undefined;
    onStartShouldSetResponder?: ((event: GestureResponderEvent) => boolean) | undefined;
    onMoveShouldSetResponder?: ((event: GestureResponderEvent) => boolean) | undefined;
    onResponderGrant?: ((event: GestureResponderEvent) => void) | undefined;
    onResponderMove?: ((event: GestureResponderEvent) => void) | undefined;
    onResponderRelease?: ((event: GestureResponderEvent) => void) | undefined;
    onResponderTerminate?: ((event: GestureResponderEvent) => void) | undefined;
    onResponderTerminationRequest?: ((event: GestureResponderEvent) => boolean) | undefined;
    onTouchStart?: ((event: GestureResponderEvent) => void) | undefined;
    onTouchMove?: ((event: GestureResponderEvent) => void) | undefined;
    onTouchEnd?: ((event: GestureResponderEvent) => void) | undefined;
    onTouchCancel?: ((event: GestureResponderEvent) => void) | undefined;
  }
  export interface NativeMethods {
    measure(callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void): void;
    measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
    measureLayout(relativeToNativeNode: any, onSuccess: (left: number, top: number, width: number, height: number) => void, onFail?: () => void): void;
    setNativeProps(nativeProps: object): void;
    focus(): void;
    blur(): void;
  }
  export class View extends Component<ViewProps> {}
  export interface View extends NativeMethods {}

  // ---------- Text ----------
  export interface TextProps extends AccessibilityProps {
    children?: ReactNode | undefined;
    style?: StyleProp<TextStyle> | undefined;
    numberOfLines?: number | undefined;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' | undefined;
    adjustsFontSizeToFit?: boolean | undefined;
    minimumFontScale?: number | undefined;
    allowFontScaling?: boolean | undefined;
    maxFontSizeMultiplier?: number | null | undefined;
    selectable?: boolean | undefined;
    selectionColor?: ColorValue | undefined;
    suppressHighlighting?: boolean | undefined;
    onPress?: ((event: GestureResponderEvent) => void) | undefined;
    onLongPress?: ((event: GestureResponderEvent) => void) | undefined;
    onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
    onTextLayout?: ((event: NativeSyntheticEvent<{ lines: Array<LayoutRectangle & { text: string; ascender: number; descender: number; capHeight: number; xHeight: number }> }>) => void) | undefined;
    testID?: string | undefined;
    nativeID?: string | undefined;
    id?: string | undefined;
    dynamicTypeRamp?: string | undefined;
    lineBreakMode?: 'head' | 'middle' | 'tail' | 'clip' | undefined;
    lineBreakStrategyIOS?: 'none' | 'standard' | 'hangul-word' | 'push-out' | undefined;
    textBreakStrategy?: 'simple' | 'highQuality' | 'balanced' | undefined;
    disabled?: boolean | undefined;
    hitSlop?: Insets | number | undefined;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined;
  }
  export class Text extends Component<TextProps> {}
  export interface Text extends NativeMethods {}

  // ---------- Pressable ----------
  export interface PressableStateCallbackType {
    readonly pressed: boolean;
    readonly hovered?: boolean;
  }
  export interface PressableAndroidRippleConfig {
    color?: ColorValue | undefined;
    borderless?: boolean | undefined;
    radius?: number | undefined;
    foreground?: boolean | undefined;
  }
  export interface PressableProps extends AccessibilityProps, Omit<ViewProps, 'children' | 'style' | 'hitSlop'> {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    onPressIn?: null | ((event: GestureResponderEvent) => void) | undefined;
    onPressOut?: null | ((event: GestureResponderEvent) => void) | undefined;
    onLongPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    onHoverIn?: null | ((event: MouseEvent) => void) | undefined;
    onHoverOut?: null | ((event: MouseEvent) => void) | undefined;
    onBlur?: null | ((event: NativeSyntheticEvent<any>) => void) | undefined;
    onFocus?: null | ((event: NativeSyntheticEvent<any>) => void) | undefined;
    cancelable?: null | boolean | undefined;
    delayHoverIn?: number | null | undefined;
    delayHoverOut?: number | null | undefined;
    delayLongPress?: null | number | undefined;
    disabled?: null | boolean | undefined;
    hitSlop?: null | Insets | number | undefined;
    pressRetentionOffset?: null | Insets | number | undefined;
    android_disableSound?: null | boolean | undefined;
    android_ripple?: null | PressableAndroidRippleConfig | undefined;
    testOnly_pressed?: null | boolean | undefined;
    unstable_pressDelay?: number | undefined;
    children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode) | undefined;
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>) | undefined;
  }
  export const Pressable: import('react').ForwardRefExoticComponent<PressableProps & import('react').RefAttributes<View>>;

  // ---------- ScrollView ----------
  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle> | undefined;
    horizontal?: boolean | null | undefined;
    showsHorizontalScrollIndicator?: boolean | undefined;
    showsVerticalScrollIndicator?: boolean | undefined;
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled' | undefined;
    keyboardDismissMode?: 'none' | 'interactive' | 'on-drag' | undefined;
    onScroll?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
    onScrollBeginDrag?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
    onScrollEndDrag?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
    onMomentumScrollBegin?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
    onMomentumScrollEnd?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
    onContentSizeChange?: ((w: number, h: number) => void) | undefined;
    scrollEventThrottle?: number | undefined;
    scrollEnabled?: boolean | undefined;
    pagingEnabled?: boolean | undefined;
    bounces?: boolean | undefined;
    alwaysBounceVertical?: boolean | undefined;
    alwaysBounceHorizontal?: boolean | undefined;
    decelerationRate?: 'fast' | 'normal' | number | undefined;
    snapToInterval?: number | undefined;
    snapToOffsets?: number[] | undefined;
    snapToAlignment?: 'start' | 'center' | 'end' | undefined;
    snapToStart?: boolean | undefined;
    snapToEnd?: boolean | undefined;
    disableIntervalMomentum?: boolean | undefined;
    contentInset?: Insets | undefined;
    contentOffset?: NativeScrollPoint | undefined;
    contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always' | undefined;
    automaticallyAdjustContentInsets?: boolean | undefined;
    automaticallyAdjustKeyboardInsets?: boolean | undefined;
    automaticallyAdjustsScrollIndicatorInsets?: boolean | undefined;
    scrollIndicatorInsets?: Insets | undefined;
    stickyHeaderIndices?: number[] | undefined;
    nestedScrollEnabled?: boolean | undefined;
    overScrollMode?: 'auto' | 'always' | 'never' | undefined;
    centerContent?: boolean | undefined;
    directionalLockEnabled?: boolean | undefined;
    indicatorStyle?: 'default' | 'black' | 'white' | undefined;
    refreshControl?: ReactElement | undefined;
    scrollToOverflowEnabled?: boolean | undefined;
    fadingEdgeLength?: number | undefined;
    maintainVisibleContentPosition?: { minIndexForVisible: number; autoscrollToTopThreshold?: number | null } | null | undefined;
    invertStickyHeaders?: boolean | undefined;
  }
  export class ScrollView extends Component<ScrollViewProps> {
    scrollTo(y?: number | { x?: number; y?: number; animated?: boolean }, deprecatedX?: number, deprecatedAnimated?: boolean): void;
    scrollToEnd(options?: { animated?: boolean }): void;
    flashScrollIndicators(): void;
  }
  export interface ScrollView extends NativeMethods {}

  // ---------- Switch ----------
  export interface SwitchProps extends ViewProps {
    value?: boolean | undefined;
    onValueChange?: ((value: boolean) => Promise<void> | void) | null | undefined;
    onChange?: ((event: NativeSyntheticEvent<{ value: boolean }>) => Promise<void> | void) | null | undefined;
    disabled?: boolean | undefined;
    trackColor?: { false?: ColorValue | null | undefined; true?: ColorValue | null | undefined } | undefined;
    thumbColor?: ColorValue | undefined;
    ios_backgroundColor?: ColorValue | undefined;
  }
  export class Switch extends Component<SwitchProps> {}

  // ---------- TextInput ----------
  export type KeyboardTypeOptions = 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'ascii-capable' | 'numbers-and-punctuation' | 'url' | 'name-phone-pad' | 'twitter' | 'web-search' | 'visible-password';
  export type ReturnKeyTypeOptions = 'done' | 'go' | 'next' | 'search' | 'send' | 'none' | 'previous' | 'default' | 'emergency-call' | 'google' | 'join' | 'route' | 'yahoo';
  export type InputModeOptions = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  export type EnterKeyHintTypeOptions = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  export interface TextInputProps extends ViewProps {
    allowFontScaling?: boolean | undefined;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | undefined;
    autoComplete?: string | undefined;
    autoCorrect?: boolean | undefined;
    autoFocus?: boolean | undefined;
    blurOnSubmit?: boolean | undefined;
    submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline' | undefined;
    caretHidden?: boolean | undefined;
    clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always' | undefined;
    clearTextOnFocus?: boolean | undefined;
    contextMenuHidden?: boolean | undefined;
    defaultValue?: string | undefined;
    editable?: boolean | undefined;
    readOnly?: boolean | undefined;
    enablesReturnKeyAutomatically?: boolean | undefined;
    enterKeyHint?: EnterKeyHintTypeOptions | undefined;
    inputMode?: InputModeOptions | undefined;
    keyboardAppearance?: 'default' | 'light' | 'dark' | undefined;
    keyboardType?: KeyboardTypeOptions | undefined;
    maxLength?: number | undefined;
    multiline?: boolean | undefined;
    numberOfLines?: number | undefined;
    onBlur?: ((e: NativeSyntheticEvent<any>) => void) | undefined;
    onFocus?: ((e: NativeSyntheticEvent<any>) => void) | undefined;
    onChange?: ((e: NativeSyntheticEvent<{ text: string; eventCount: number; target: number }>) => void) | undefined;
    onChangeText?: ((text: string) => void) | undefined;
    onEndEditing?: ((e: NativeSyntheticEvent<{ text: string }>) => void) | undefined;
    onSubmitEditing?: ((e: NativeSyntheticEvent<{ text: string }>) => void) | undefined;
    onKeyPress?: ((e: NativeSyntheticEvent<{ key: string }>) => void) | undefined;
    onSelectionChange?: ((e: NativeSyntheticEvent<{ selection: { start: number; end: number } }>) => void) | undefined;
    placeholder?: string | undefined;
    placeholderTextColor?: ColorValue | undefined;
    returnKeyType?: ReturnKeyTypeOptions | undefined;
    secureTextEntry?: boolean | undefined;
    selectTextOnFocus?: boolean | undefined;
    selection?: { start: number; end?: number | undefined } | undefined;
    selectionColor?: ColorValue | undefined;
    cursorColor?: ColorValue | null | undefined;
    spellCheck?: boolean | undefined;
    style?: StyleProp<TextStyle> | undefined;
    textAlign?: 'left' | 'center' | 'right' | undefined;
    textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center' | undefined;
    textContentType?: string | undefined;
    value?: string | undefined;
    maxFontSizeMultiplier?: number | null | undefined;
    scrollEnabled?: boolean | undefined;
    dataDetectorTypes?: string | string[] | undefined;
    underlineColorAndroid?: ColorValue | undefined;
    importantForAutofill?: 'auto' | 'no' | 'noExcludeDescendants' | 'yes' | 'yesExcludeDescendants' | undefined;
    rows?: number | undefined;
  }
  export class TextInput extends Component<TextInputProps> {
    isFocused(): boolean;
    clear(): void;
    setSelection(start: number, end: number): void;
  }
  export interface TextInput extends NativeMethods {}

  // ---------- Image ----------
  export type ImageResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' | 'none';
  export interface ImageURISource {
    uri?: string | undefined;
    bundle?: string | undefined;
    method?: string | undefined;
    headers?: { [key: string]: string } | undefined;
    cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached' | undefined;
    body?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    scale?: number | undefined;
  }
  export type ImageRequireSource = number;
  export type ImageSourcePropType = ImageURISource | ImageURISource[] | ImageRequireSource;
  export interface ImageProps extends AccessibilityProps {
    source?: ImageSourcePropType | undefined;
    src?: string | undefined;
    style?: StyleProp<ImageStyle> | undefined;
    resizeMode?: ImageResizeMode | undefined;
    blurRadius?: number | undefined;
    defaultSource?: ImageURISource | ImageRequireSource | undefined;
    fadeDuration?: number | undefined;
    onLoad?: ((event: NativeSyntheticEvent<{ source: { width: number; height: number; uri: string } }>) => void) | undefined;
    onLoadStart?: (() => void) | undefined;
    onLoadEnd?: (() => void) | undefined;
    onError?: ((event: NativeSyntheticEvent<{ error: any }>) => void) | undefined;
    onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
    testID?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    tintColor?: ColorValue | undefined;
    alt?: string | undefined;
    progressiveRenderingEnabled?: boolean | undefined;
    borderRadius?: number | undefined;
    capInsets?: Insets | undefined;
    loadingIndicatorSource?: ImageURISource | undefined;
    resizeMethod?: 'auto' | 'resize' | 'scale' | 'none' | undefined;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined;
  }
  export class Image extends Component<ImageProps> {
    static getSize(uri: string, success?: (width: number, height: number) => void, failure?: (error: any) => void): Promise<{ width: number; height: number }>;
    static prefetch(url: string): Promise<boolean>;
    static resolveAssetSource(source: ImageSourcePropType): ImageResolvedAssetSource;
  }
  export interface ImageResolvedAssetSource {
    height: number;
    width: number;
    scale: number;
    uri: string;
  }

  // ---------- ActivityIndicator / Modal ----------
  export interface ActivityIndicatorProps extends ViewProps {
    animating?: boolean | undefined;
    color?: ColorValue | undefined;
    hidesWhenStopped?: boolean | undefined;
    size?: number | 'small' | 'large' | undefined;
  }
  export class ActivityIndicator extends Component<ActivityIndicatorProps> {}

  export interface ModalProps extends ViewProps {
    animationType?: 'none' | 'slide' | 'fade' | undefined;
    transparent?: boolean | undefined;
    visible?: boolean | undefined;
    onRequestClose?: ((event: NativeSyntheticEvent<any>) => void) | undefined;
    onShow?: ((event: NativeSyntheticEvent<any>) => void) | undefined;
    onDismiss?: (() => void) | undefined;
    presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen' | undefined;
    statusBarTranslucent?: boolean | undefined;
    navigationBarTranslucent?: boolean | undefined;
    hardwareAccelerated?: boolean | undefined;
    supportedOrientations?: Array<'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right'> | undefined;
    onOrientationChange?: ((event: NativeSyntheticEvent<any>) => void) | undefined;
    backdropColor?: ColorValue | undefined;
  }
  export class Modal extends Component<ModalProps> {}

  // ---------- FlatList (minimal) ----------
  export interface ListRenderItemInfo<ItemT> {
    item: ItemT;
    index: number;
    separators: { highlight: () => void; unhighlight: () => void; updateProps: (select: 'leading' | 'trailing', newProps: any) => void };
  }
  export type ListRenderItem<ItemT> = (info: ListRenderItemInfo<ItemT>) => ReactElement | null;
  export interface FlatListProps<ItemT> extends ScrollViewProps {
    data: ArrayLike<ItemT> | null | undefined;
    renderItem: ListRenderItem<ItemT> | null | undefined;
    keyExtractor?: ((item: ItemT, index: number) => string) | undefined;
    numColumns?: number | undefined;
    columnWrapperStyle?: StyleProp<ViewStyle> | undefined;
    ListHeaderComponent?: ComponentType<any> | ReactElement | null | undefined;
    ListFooterComponent?: ComponentType<any> | ReactElement | null | undefined;
    ListEmptyComponent?: ComponentType<any> | ReactElement | null | undefined;
    ItemSeparatorComponent?: ComponentType<any> | null | undefined;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
    extraData?: any;
    initialNumToRender?: number | undefined;
    maxToRenderPerBatch?: number | undefined;
    windowSize?: number | undefined;
    getItemLayout?: ((data: ArrayLike<ItemT> | null | undefined, index: number) => { length: number; offset: number; index: number }) | undefined;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    onEndReachedThreshold?: number | null | undefined;
    refreshing?: boolean | null | undefined;
    onRefresh?: (() => void) | null | undefined;
    inverted?: boolean | null | undefined;
  }
  export class FlatList<ItemT = any> extends Component<FlatListProps<ItemT>> {
    scrollToIndex(params: { animated?: boolean | null; index: number; viewOffset?: number; viewPosition?: number }): void;
    scrollToOffset(params: { animated?: boolean | null; offset: number }): void;
    scrollToEnd(params?: { animated?: boolean | null }): void;
  }

  // ---------- APIs ----------
  export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'native';
  interface PlatformStatic {
    OS: PlatformOSType;
    Version: number | string;
    isPad: boolean;
    isTV: boolean;
    isTesting: boolean;
    constants: { [key: string]: any };
    select<T>(specifics: ({ [platform in PlatformOSType]?: T } & { default: T }) | { [platform in PlatformOSType]: T }): T;
    select<T>(specifics: { [platform in PlatformOSType]?: T }): T | undefined;
  }
  export const Platform: PlatformStatic;

  export interface AlertButton {
    text?: string | undefined;
    onPress?: ((value?: string) => void) | undefined;
    isPreferred?: boolean | undefined;
    style?: 'default' | 'cancel' | 'destructive' | undefined;
  }
  export interface AlertOptions {
    cancelable?: boolean | undefined;
    userInterfaceStyle?: 'unspecified' | 'light' | 'dark' | undefined;
    onDismiss?: (() => void) | undefined;
  }
  export const Alert: {
    alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void;
    prompt(title: string, message?: string, callbackOrButtons?: ((text: string) => void) | AlertButton[], type?: string, defaultValue?: string, keyboardType?: string): void;
  };

  export interface EmitterSubscription {
    remove(): void;
  }
  export interface NativeEventSubscription {
    remove(): void;
  }

  export const Linking: {
    openURL(url: string): Promise<any>;
    canOpenURL(url: string): Promise<boolean>;
    openSettings(): Promise<void>;
    getInitialURL(): Promise<string | null>;
    addEventListener(type: 'url', handler: (event: { url: string }) => void): EmitterSubscription;
    sendIntent(action: string, extras?: Array<{ key: string; value: string | number | boolean }>): Promise<void>;
  };

  type AccessibilityChangeEventName = 'reduceMotionChanged' | 'screenReaderChanged' | 'boldTextChanged' | 'grayscaleChanged' | 'invertColorsChanged' | 'reduceTransparencyChanged' | 'darkerSystemColorsChanged' | 'highTextContrastChanged';
  export const AccessibilityInfo: {
    isBoldTextEnabled(): Promise<boolean>;
    isGrayscaleEnabled(): Promise<boolean>;
    isInvertColorsEnabled(): Promise<boolean>;
    isReduceMotionEnabled(): Promise<boolean>;
    isReduceTransparencyEnabled(): Promise<boolean>;
    isScreenReaderEnabled(): Promise<boolean>;
    prefersCrossFadeTransitions(): Promise<boolean>;
    addEventListener(eventName: AccessibilityChangeEventName, handler: (event: boolean) => void): EmitterSubscription;
    addEventListener(eventName: 'announcementFinished', handler: (event: { announcement: string; success: boolean }) => void): EmitterSubscription;
    announceForAccessibility(announcement: string): void;
    announceForAccessibilityWithOptions(announcement: string, options: { queue?: boolean | undefined }): void;
    setAccessibilityFocus(reactTag: number): void;
  };

  export interface ScaledSize {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  }
  export const Dimensions: {
    get(dim: 'window' | 'screen'): ScaledSize;
    addEventListener(type: 'change', handler: (dims: { window: ScaledSize; screen: ScaledSize }) => void): EmitterSubscription;
  };
  export function useWindowDimensions(): ScaledSize;

  export const DevSettings: {
    addMenuItem(title: string, handler: () => any): void;
    reload(reason?: string): void;
  };

  export const I18nManager: {
    isRTL: boolean;
    doLeftAndRightSwapInRTL: boolean;
    allowRTL(allowRTL: boolean): void;
    forceRTL(forceRTL: boolean): void;
    swapLeftAndRightInRTL(swap: boolean): void;
    getConstants(): { isRTL: boolean; doLeftAndRightSwapInRTL: boolean; localeIdentifier?: string | null };
  };

  export const PixelRatio: {
    get(): number;
    getFontScale(): number;
    getPixelSizeForLayoutSize(layoutSize: number): number;
    roundToNearestPixel(layoutSize: number): number;
  };

  export type ColorSchemeName = 'light' | 'dark' | 'unspecified' | null | undefined;
  export function useColorScheme(): ColorSchemeName;
  export const Appearance: {
    getColorScheme(): ColorSchemeName;
    setColorScheme(scheme: ColorSchemeName): void;
    addChangeListener(listener: (prefs: { colorScheme: ColorSchemeName }) => void): NativeEventSubscription;
  };

  export interface LayoutAnimationConfig {
    duration: number;
    create?: object | undefined;
    update?: object | undefined;
    delete?: object | undefined;
  }
  export const LayoutAnimation: {
    configureNext(config: LayoutAnimationConfig, onAnimationDidEnd?: () => void, onAnimationDidFail?: () => void): void;
    create(duration: number, type?: string, creationProp?: string): LayoutAnimationConfig;
    Presets: { easeInEaseOut: LayoutAnimationConfig; linear: LayoutAnimationConfig; spring: LayoutAnimationConfig };
    easeInEaseOut(onAnimationDidEnd?: () => void): void;
    linear(onAnimationDidEnd?: () => void): void;
    spring(onAnimationDidEnd?: () => void): void;
  };

  export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  export const AppState: {
    currentState: AppStateStatus;
    isAvailable: boolean;
    addEventListener(type: 'change' | 'memoryWarning' | 'blur' | 'focus', listener: (state: AppStateStatus) => void): NativeEventSubscription;
  };

  export const Keyboard: {
    dismiss(): void;
    addListener(eventName: string, callback: (event: any) => void): EmitterSubscription;
  };
  export const Share: {
    share(content: { message?: string; url?: string; title?: string }, options?: object): Promise<{ action: string; activityType?: string | null }>;
  };
  export const Vibration: { vibrate(pattern?: number | number[], repeat?: boolean): void; cancel(): void };
  export function findNodeHandle(componentOrHandle: any): number | null;

  // ---------- Animated (core) ----------
  export type EasingFunction = (value: number) => number;
  export interface EasingStatic {
    step0: EasingFunction;
    step1: EasingFunction;
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
    bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
    in(easing: EasingFunction): EasingFunction;
    out(easing: EasingFunction): EasingFunction;
    inOut(easing: EasingFunction): EasingFunction;
  }
  export const Easing: EasingStatic;

  export namespace Animated {
    type ExtrapolateType = 'extend' | 'identity' | 'clamp';
    interface InterpolationConfigType {
      inputRange: number[];
      outputRange: number[] | string[];
      easing?: ((input: number) => number) | undefined;
      extrapolate?: ExtrapolateType | undefined;
      extrapolateLeft?: ExtrapolateType | undefined;
      extrapolateRight?: ExtrapolateType | undefined;
    }
    class AnimatedNode {}
    class AnimatedWithChildren extends AnimatedNode {}
    class AnimatedInterpolation<OutputT extends number | string = number | string> extends AnimatedWithChildren {
      interpolate(config: InterpolationConfigType): AnimatedInterpolation<OutputT>;
    }
    type ValueListenerCallback = (state: { value: number }) => void;
    class Value extends AnimatedWithChildren {
      constructor(value: number, config?: { useNativeDriver: boolean });
      setValue(value: number): void;
      setOffset(offset: number): void;
      flattenOffset(): void;
      extractOffset(): void;
      addListener(callback: ValueListenerCallback): string;
      removeListener(id: string): void;
      removeAllListeners(): void;
      stopAnimation(callback?: (value: number) => void): void;
      resetAnimation(callback?: (value: number) => void): void;
      interpolate<OutputT extends number | string>(config: InterpolationConfigType): AnimatedInterpolation<OutputT>;
    }
    class ValueXY extends AnimatedWithChildren {
      x: Value;
      y: Value;
      constructor(value?: { x: number | Value; y: number | Value });
      setValue(value: { x: number; y: number }): void;
      getLayout(): { [key: string]: Value };
      getTranslateTransform(): Array<{ translateX: Value } | { translateY: Value }>;
    }
    type EndResult = { finished: boolean };
    type EndCallback = (result: EndResult) => void;
    interface CompositeAnimation {
      start(callback?: EndCallback): void;
      stop(): void;
      reset(): void;
    }
    interface AnimationConfig {
      isInteraction?: boolean | undefined;
      useNativeDriver: boolean;
    }
    interface TimingAnimationConfig extends AnimationConfig {
      toValue: number | Value | AnimatedInterpolation<number>;
      easing?: ((value: number) => number) | undefined;
      duration?: number | undefined;
      delay?: number | undefined;
    }
    interface SpringAnimationConfig extends AnimationConfig {
      toValue: number | Value | AnimatedInterpolation<number>;
      overshootClamping?: boolean | undefined;
      restDisplacementThreshold?: number | undefined;
      restSpeedThreshold?: number | undefined;
      velocity?: number | undefined;
      bounciness?: number | undefined;
      speed?: number | undefined;
      tension?: number | undefined;
      friction?: number | undefined;
      stiffness?: number | undefined;
      mass?: number | undefined;
      damping?: number | undefined;
      delay?: number | undefined;
    }
    function timing(value: Value | ValueXY, config: TimingAnimationConfig): CompositeAnimation;
    function spring(value: Value | ValueXY, config: SpringAnimationConfig): CompositeAnimation;
    function decay(value: Value | ValueXY, config: AnimationConfig & { velocity: number; deceleration?: number }): CompositeAnimation;
    function delay(time: number): CompositeAnimation;
    function sequence(animations: CompositeAnimation[]): CompositeAnimation;
    function parallel(animations: CompositeAnimation[], config?: { stopTogether?: boolean }): CompositeAnimation;
    function stagger(time: number, animations: CompositeAnimation[]): CompositeAnimation;
    function loop(animation: CompositeAnimation, config?: { iterations?: number; resetBeforeIteration?: boolean }): CompositeAnimation;
    function event<T = any>(argMapping: Array<any>, config?: { useNativeDriver: boolean; listener?: (event: T) => void }): (...args: any[]) => void;
    function add(a: AnimatedNode | number, b: AnimatedNode | number): AnimatedInterpolation<number>;
    function multiply(a: AnimatedNode | number, b: AnimatedNode | number): AnimatedInterpolation<number>;
    function diffClamp(a: AnimatedNode, min: number, max: number): AnimatedInterpolation<number>;

    // Animated props accept Animated values anywhere a style value is accepted.
    type WithAnimatedValue<T> = T extends object ? { [K in keyof T]?: WithAnimatedValue<T[K]> | AnimatedNode } : T | AnimatedNode;
    // Style values may be Animated nodes; kept permissive (any) as the real mapped type is huge.
    type AnimatedProps<P> = { [K in keyof P]: K extends 'style' ? any : P[K] };
    type AnimatedComponent<C extends ComponentType<any>> = ComponentType<AnimatedProps<import('react').ComponentProps<C>> & import('react').RefAttributes<any>>;
    function createAnimatedComponent<C extends ComponentType<any>>(component: C): AnimatedComponent<C>;
    const View: AnimatedComponent<typeof import('react-native').View>;
    const Text: AnimatedComponent<typeof import('react-native').Text>;
    const Image: AnimatedComponent<typeof import('react-native').Image>;
    const ScrollView: AnimatedComponent<typeof import('react-native').ScrollView>;
    const FlatList: AnimatedComponent<typeof import('react-native').FlatList>;
  }

  export type HostComponent<P> = ComponentType<P>;
  export const NativeModules: { [name: string]: any };
  export const TurboModuleRegistry: { get<T>(name: string): T | null; getEnforcing<T>(name: string): T };
  export function requireNativeComponent<T>(viewName: string): HostComponent<T>;
  export type RefForView = Ref<View>;
}
