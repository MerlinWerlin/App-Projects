// Offline stub of react-native 0.81 public types (the members the app uses).
// Shapes follow react-native/types (index.d.ts + Libraries/**/*.d.ts); see README.md.
import * as React from 'react';

type Falsy = undefined | null | false | '';
interface RecursiveArray<T> extends Array<T | ReadonlyArray<T> | RecursiveArray<T>> {}

// ---------------------------------------------------------------- styles
export type ColorValue = string | OpaqueColorValue;
export type OpaqueColorValue = symbol & { __TYPE__: 'Color' };
export type DimensionValue = number | 'auto' | `${number}%` | Animated.AnimatedNode | null;
type AnimatableNumericValue = number | Animated.AnimatedNode;
type AnimatableStringValue = string | Animated.AnimatedNode;
export type FlexAlignType = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
export type CursorValue = 'auto' | 'pointer';

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
  marginBlockEnd?: DimensionValue | undefined;
  marginBlockStart?: DimensionValue | undefined;
  marginInline?: DimensionValue | undefined;
  marginInlineEnd?: DimensionValue | undefined;
  marginInlineStart?: DimensionValue | undefined;
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
  paddingBlockEnd?: DimensionValue | undefined;
  paddingBlockStart?: DimensionValue | undefined;
  paddingInline?: DimensionValue | undefined;
  paddingInlineEnd?: DimensionValue | undefined;
  paddingInlineStart?: DimensionValue | undefined;
  position?: 'absolute' | 'relative' | 'static' | undefined;
  right?: DimensionValue | undefined;
  start?: DimensionValue | undefined;
  top?: DimensionValue | undefined;
  inset?: DimensionValue | undefined;
  insetBlock?: DimensionValue | undefined;
  insetBlockEnd?: DimensionValue | undefined;
  insetBlockStart?: DimensionValue | undefined;
  insetInline?: DimensionValue | undefined;
  insetInlineEnd?: DimensionValue | undefined;
  insetInlineStart?: DimensionValue | undefined;
  width?: DimensionValue | undefined;
  zIndex?: number | undefined;
  direction?: 'inherit' | 'ltr' | 'rtl' | undefined;
}

export interface ShadowStyleIOS {
  shadowColor?: ColorValue | undefined;
  shadowOffset?: Readonly<{ width: number; height: number }> | undefined;
  shadowOpacity?: AnimatableNumericValue | undefined;
  shadowRadius?: number | undefined;
}

type MatrixTransform = { matrix: AnimatableNumericValue[] };
type TransformEntry =
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
  | MatrixTransform;

export interface TransformsStyle {
  transform?: Readonly<TransformEntry[]> | string | undefined;
  transformOrigin?: Array<string | number> | string | undefined;
}

export type BoxShadowValue = {
  offsetX: number | string;
  offsetY: number | string;
  color?: string | undefined;
  blurRadius?: ColorValue | number | undefined;
  spreadDistance?: number | string | undefined;
  inset?: boolean | undefined;
};
export type FilterFunction =
  | { brightness: number | string }
  | { blur: number | string }
  | { contrast: number | string }
  | { grayscale: number | string }
  | { hueRotate: number | string }
  | { invert: number | string }
  | { opacity: number | string }
  | { saturate: number | string }
  | { sepia: number | string }
  | { dropShadow: object | string };
type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface ViewStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
  backfaceVisibility?: 'visible' | 'hidden' | undefined;
  backgroundColor?: ColorValue | undefined;
  borderBlockColor?: ColorValue | undefined;
  borderBlockEndColor?: ColorValue | undefined;
  borderBlockStartColor?: ColorValue | undefined;
  borderBottomColor?: ColorValue | undefined;
  borderBottomEndRadius?: AnimatableNumericValue | string | undefined;
  borderBottomLeftRadius?: AnimatableNumericValue | string | undefined;
  borderBottomRightRadius?: AnimatableNumericValue | string | undefined;
  borderBottomStartRadius?: AnimatableNumericValue | string | undefined;
  borderColor?: ColorValue | undefined;
  borderCurve?: 'circular' | 'continuous' | undefined;
  borderEndColor?: ColorValue | undefined;
  borderEndEndRadius?: AnimatableNumericValue | string | undefined;
  borderEndStartRadius?: AnimatableNumericValue | string | undefined;
  borderLeftColor?: ColorValue | undefined;
  borderRadius?: AnimatableNumericValue | string | undefined;
  borderRightColor?: ColorValue | undefined;
  borderStartColor?: ColorValue | undefined;
  borderStartEndRadius?: AnimatableNumericValue | string | undefined;
  borderStartStartRadius?: AnimatableNumericValue | string | undefined;
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
  cursor?: CursorValue | undefined;
  boxShadow?: ReadonlyArray<BoxShadowValue> | string | undefined;
  filter?: ReadonlyArray<FilterFunction> | string | undefined;
  mixBlendMode?: BlendMode | undefined;
  experimental_backgroundImage?: ReadonlyArray<unknown> | string | undefined;
}

export type FontVariant = 'small-caps' | 'oldstyle-nums' | 'lining-nums' | 'tabular-nums' | 'common-ligatures' | 'no-common-ligatures' | 'discretionary-ligatures' | 'no-discretionary-ligatures' | 'historical-ligatures' | 'no-historical-ligatures' | 'contextual' | 'no-contextual' | 'proportional-nums' | 'stylistic-one' | 'stylistic-two' | 'stylistic-three' | 'stylistic-four' | 'stylistic-five' | 'stylistic-six' | 'stylistic-seven' | 'stylistic-eight' | 'stylistic-nine' | 'stylistic-ten' | 'stylistic-eleven' | 'stylistic-twelve' | 'stylistic-thirteen' | 'stylistic-fourteen' | 'stylistic-fifteen' | 'stylistic-sixteen' | 'stylistic-seventeen' | 'stylistic-eighteen' | 'stylistic-nineteen' | 'stylistic-twenty';

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
  textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through' | undefined;
  textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed' | undefined;
  textDecorationColor?: ColorValue | undefined;
  textShadowColor?: ColorValue | undefined;
  textShadowOffset?: { width: number; height: number } | undefined;
  textShadowRadius?: number | undefined;
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase' | undefined;
  userSelect?: 'auto' | 'none' | 'text' | 'contain' | 'all' | undefined;
  fontVariant?: FontVariant[] | undefined;
  writingDirection?: 'auto' | 'ltr' | 'rtl' | undefined;
  includeFontPadding?: boolean | undefined;
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center' | undefined;
  verticalAlign?: 'auto' | 'top' | 'bottom' | 'middle' | undefined;
}

export type ImageResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' | 'none';
export interface ImageStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
  resizeMode?: ImageResizeMode | undefined;
  backfaceVisibility?: 'visible' | 'hidden' | undefined;
  borderBottomLeftRadius?: AnimatableNumericValue | string | undefined;
  borderBottomRightRadius?: AnimatableNumericValue | string | undefined;
  backgroundColor?: ColorValue | undefined;
  borderColor?: ColorValue | undefined;
  borderRadius?: AnimatableNumericValue | string | undefined;
  borderTopLeftRadius?: AnimatableNumericValue | string | undefined;
  borderTopRightRadius?: AnimatableNumericValue | string | undefined;
  overlayColor?: ColorValue | undefined;
  tintColor?: ColorValue | undefined;
  opacity?: AnimatableNumericValue | undefined;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none' | undefined;
  cursor?: CursorValue | undefined;
  boxShadow?: ReadonlyArray<BoxShadowValue> | string | undefined;
  filter?: ReadonlyArray<FilterFunction> | string | undefined;
  mixBlendMode?: BlendMode | undefined;
}

declare const registeredStyleBrand: unique symbol;
export type RegisteredStyle<T> = number & { [registeredStyleBrand]: T };
export type StyleProp<T> = T | RegisteredStyle<T> | RecursiveArray<T | RegisteredStyle<T> | Falsy> | Falsy;

export namespace StyleSheet {
  type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
  type AbsoluteFillStyle = {
    position: 'absolute';
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  };
  function create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T & NamedStyles<any>): T;
  function flatten<T>(style?: StyleProp<T>): T extends (infer U)[] ? U : T;
  function compose<T extends ViewStyle | TextStyle | ImageStyle>(style1: StyleProp<T>, style2: StyleProp<T>): StyleProp<T>;
  const hairlineWidth: number;
  const absoluteFill: AbsoluteFillStyle;
  const absoluteFillObject: AbsoluteFillStyle;
}

// ---------------------------------------------------------------- events
export interface NativeSyntheticEvent<T> {
  nativeEvent: T;
  currentTarget: number | object;
  target: number | object;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  eventPhase: number;
  isTrusted: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  persist(): void;
  timeStamp: number;
  type: string;
}
export interface LayoutRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;
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
export interface NativeScrollPoint {
  x: number;
  y: number;
}
export interface NativeScrollSize {
  height: number;
  width: number;
}
export interface NativeScrollRectangle {
  left: number;
  top: number;
  bottom: number;
  right: number;
}
export interface NativeScrollEvent {
  contentInset: NativeScrollRectangle;
  contentOffset: NativeScrollPoint;
  contentSize: NativeScrollSize;
  layoutMeasurement: NativeScrollSize;
  velocity?: NativeScrollPoint | undefined;
  zoomScale: number;
  targetContentOffset?: NativeScrollPoint | undefined;
}

// ---------------------------------------------------------------- accessibility
export type AccessibilityRole =
  | 'none' | 'button' | 'togglebutton' | 'link' | 'search' | 'image' | 'keyboardkey' | 'text' | 'adjustable'
  | 'imagebutton' | 'header' | 'summary' | 'alert' | 'checkbox' | 'combobox' | 'menu' | 'menubar' | 'menuitem'
  | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar' | 'spinbutton' | 'switch' | 'tab' | 'tabbar' | 'tablist'
  | 'timer' | 'list' | 'toolbar' | 'grid' | 'pager' | 'scrollview' | 'horizontalscrollview' | 'viewgroup'
  | 'webview' | 'drawerlayout' | 'slidingdrawer' | 'iconmenu';
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
export type AccessibilityActionName = 'activate' | 'increment' | 'decrement' | 'longpress' | 'magicTap' | 'escape' | (string & {});
export type AccessibilityActionInfo = Readonly<{ name: AccessibilityActionName; label?: string | undefined }>;
export type AccessibilityActionEvent = NativeSyntheticEvent<Readonly<{ actionName: string }>>;

export interface AccessibilityProps {
  accessible?: boolean | undefined;
  accessibilityActions?: ReadonlyArray<AccessibilityActionInfo> | undefined;
  accessibilityLabel?: string | undefined;
  'aria-label'?: string | undefined;
  accessibilityRole?: AccessibilityRole | undefined;
  role?: string | undefined;
  accessibilityState?: AccessibilityState | undefined;
  'aria-busy'?: boolean | undefined;
  'aria-checked'?: boolean | 'mixed' | undefined;
  'aria-disabled'?: boolean | undefined;
  'aria-expanded'?: boolean | undefined;
  'aria-selected'?: boolean | undefined;
  'aria-hidden'?: boolean | undefined;
  'aria-live'?: 'polite' | 'assertive' | 'off' | undefined;
  'aria-modal'?: boolean | undefined;
  accessibilityHint?: string | undefined;
  accessibilityValue?: AccessibilityValue | undefined;
  onAccessibilityAction?: ((event: AccessibilityActionEvent) => void) | undefined;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants' | undefined;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive' | undefined;
  accessibilityLabelledBy?: string | string[] | undefined;
  accessibilityElementsHidden?: boolean | undefined;
  accessibilityViewIsModal?: boolean | undefined;
  accessibilityIgnoresInvertColors?: boolean | undefined;
  accessibilityLanguage?: string | undefined;
  accessibilityShowsLargeContentViewer?: boolean | undefined;
  accessibilityLargeContentTitle?: string | undefined;
  onAccessibilityEscape?: (() => void) | undefined;
  onAccessibilityTap?: (() => void) | undefined;
  onMagicTap?: (() => void) | undefined;
}

// ---------------------------------------------------------------- View
export interface Insets {
  top?: number | undefined;
  left?: number | undefined;
  bottom?: number | undefined;
  right?: number | undefined;
}
export interface GestureResponderHandlers {
  onStartShouldSetResponder?: ((event: GestureResponderEvent) => boolean) | undefined;
  onMoveShouldSetResponder?: ((event: GestureResponderEvent) => boolean) | undefined;
  onResponderEnd?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderGrant?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderReject?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderMove?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderRelease?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderStart?: ((event: GestureResponderEvent) => void) | undefined;
  onResponderTerminationRequest?: ((event: GestureResponderEvent) => boolean) | undefined;
  onResponderTerminate?: ((event: GestureResponderEvent) => void) | undefined;
  onStartShouldSetResponderCapture?: ((event: GestureResponderEvent) => boolean) | undefined;
  onMoveShouldSetResponderCapture?: ((event: GestureResponderEvent) => boolean) | undefined;
}
export interface Touchable {
  onTouchStart?: ((event: GestureResponderEvent) => void) | undefined;
  onTouchMove?: ((event: GestureResponderEvent) => void) | undefined;
  onTouchEnd?: ((event: GestureResponderEvent) => void) | undefined;
  onTouchCancel?: ((event: GestureResponderEvent) => void) | undefined;
  onTouchEndCapture?: ((event: GestureResponderEvent) => void) | undefined;
}
export interface ViewProps extends AccessibilityProps, GestureResponderHandlers, Touchable {
  children?: React.ReactNode | undefined;
  hitSlop?: null | Insets | number | undefined;
  id?: string | undefined;
  needsOffscreenAlphaCompositing?: boolean | undefined;
  onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined;
  removeClippedSubviews?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  testID?: string | undefined;
  nativeID?: string | undefined;
  collapsable?: boolean | undefined;
  collapsableChildren?: boolean | undefined;
  renderToHardwareTextureAndroid?: boolean | undefined;
  focusable?: boolean | undefined;
  tabIndex?: 0 | -1 | undefined;
  shouldRasterizeIOS?: boolean | undefined;
  isTVSelectable?: boolean | undefined;
  hasTVPreferredFocus?: boolean | undefined;
  experimental_layoutConformance?: 'strict' | 'classic' | undefined;
}

export type MeasureOnSuccessCallback = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void;
export type MeasureInWindowOnSuccessCallback = (x: number, y: number, width: number, height: number) => void;
export interface NativeMethods {
  measure(callback: MeasureOnSuccessCallback): void;
  measureInWindow(callback: MeasureInWindowOnSuccessCallback): void;
  measureLayout(relativeToNativeComponentRef: unknown, onSuccess: MeasureInWindowOnSuccessCallback, onFail?: () => void): void;
  setNativeProps(nativeProps: object): void;
  focus(): void;
  blur(): void;
}

export class View extends React.Component<ViewProps> {}
export interface View extends NativeMethods {}

// ---------------------------------------------------------------- Text
export interface TextProps extends AccessibilityProps {
  allowFontScaling?: boolean | undefined;
  children?: React.ReactNode | undefined;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' | undefined;
  id?: string | undefined;
  lineBreakMode?: 'head' | 'middle' | 'tail' | 'clip' | undefined;
  numberOfLines?: number | undefined;
  onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
  onTextLayout?: ((event: NativeSyntheticEvent<{ lines: Array<LayoutRectangle & { text: string }> }>) => void) | undefined;
  onPress?: ((event: GestureResponderEvent) => void) | undefined;
  onPressIn?: ((event: GestureResponderEvent) => void) | undefined;
  onPressOut?: ((event: GestureResponderEvent) => void) | undefined;
  onLongPress?: ((event: GestureResponderEvent) => void) | undefined;
  style?: StyleProp<TextStyle> | undefined;
  testID?: string | undefined;
  nativeID?: string | undefined;
  maxFontSizeMultiplier?: number | null | undefined;
  minimumFontScale?: number | undefined;
  adjustsFontSizeToFit?: boolean | undefined;
  selectable?: boolean | undefined;
  selectionColor?: ColorValue | undefined;
  suppressHighlighting?: boolean | undefined;
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced' | undefined;
  dataDetectorType?: null | 'phoneNumber' | 'link' | 'email' | 'none' | 'all' | undefined;
  android_hyphenationFrequency?: 'normal' | 'none' | 'full' | undefined;
  lineBreakStrategyIOS?: 'none' | 'standard' | 'hangul-word' | 'push-out' | undefined;
  dynamicTypeRamp?: string | undefined;
  disabled?: boolean | undefined;
}
export class Text extends React.Component<TextProps> {}
export interface Text extends NativeMethods {}

// ---------------------------------------------------------------- Pressable
export interface PressableStateCallbackType {
  readonly pressed: boolean;
  readonly hovered?: boolean;
}
export interface PressableAndroidRippleConfig {
  color?: ColorValue | null | undefined;
  borderless?: boolean | null | undefined;
  radius?: number | null | undefined;
  foreground?: boolean | null | undefined;
}
export interface PressableProps extends AccessibilityProps, Omit<ViewProps, 'children' | 'style' | 'hitSlop'> {
  onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
  onPressIn?: null | ((event: GestureResponderEvent) => void) | undefined;
  onPressOut?: null | ((event: GestureResponderEvent) => void) | undefined;
  onLongPress?: null | ((event: GestureResponderEvent) => void) | undefined;
  onHoverIn?: null | ((event: unknown) => void) | undefined;
  onHoverOut?: null | ((event: unknown) => void) | undefined;
  onBlur?: null | ((event: unknown) => void) | undefined;
  onFocus?: null | ((event: unknown) => void) | undefined;
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
  children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode) | undefined;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>) | undefined;
}
export const Pressable: React.ForwardRefExoticComponent<PressableProps & React.RefAttributes<View>>;

// ---------------------------------------------------------------- ScrollView
export interface PointProp {
  x: number;
  y: number;
}
export interface ScrollViewProps extends ViewProps {
  contentContainerStyle?: StyleProp<ViewStyle> | undefined;
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always' | undefined;
  contentInset?: Insets | undefined;
  contentOffset?: PointProp | undefined;
  horizontal?: boolean | null | undefined;
  keyboardDismissMode?: 'none' | 'interactive' | 'on-drag' | undefined;
  keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled' | undefined;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  onScroll?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  onScrollBeginDrag?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  onScrollEndDrag?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  onMomentumScrollBegin?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  onMomentumScrollEnd?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  pagingEnabled?: boolean | undefined;
  scrollEnabled?: boolean | undefined;
  scrollEventThrottle?: number | undefined;
  showsHorizontalScrollIndicator?: boolean | undefined;
  showsVerticalScrollIndicator?: boolean | undefined;
  stickyHeaderIndices?: number[] | undefined;
  bounces?: boolean | undefined;
  alwaysBounceVertical?: boolean | undefined;
  alwaysBounceHorizontal?: boolean | undefined;
  decelerationRate?: 'fast' | 'normal' | number | undefined;
  snapToInterval?: number | undefined;
  snapToAlignment?: 'start' | 'center' | 'end' | undefined;
  overScrollMode?: 'auto' | 'always' | 'never' | undefined;
  nestedScrollEnabled?: boolean | undefined;
  automaticallyAdjustContentInsets?: boolean | undefined;
  automaticallyAdjustKeyboardInsets?: boolean | undefined;
  scrollIndicatorInsets?: Insets | undefined;
  refreshControl?: React.ReactElement | undefined;
}
export class ScrollView extends React.Component<ScrollViewProps> {
  scrollTo(y?: number | { x?: number | undefined; y?: number | undefined; animated?: boolean | undefined }, deprecatedX?: number, deprecatedAnimated?: boolean): void;
  scrollToEnd(options?: { animated?: boolean | undefined }): void;
  flashScrollIndicators(): void;
}
export interface ScrollView extends NativeMethods {}

// ---------------------------------------------------------------- FlatList
export interface ListRenderItemInfo<ItemT> {
  item: ItemT;
  index: number;
  separators: {
    highlight: () => void;
    unhighlight: () => void;
    updateProps: (select: 'leading' | 'trailing', newProps: any) => void;
  };
}
export type ListRenderItem<ItemT> = (info: ListRenderItemInfo<ItemT>) => React.ReactElement | null;
export interface ViewToken<ItemT = any> {
  item: ItemT;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: any;
}
export interface FlatListProps<ItemT> extends ScrollViewProps {
  data: ArrayLike<ItemT> | null | undefined;
  renderItem: ListRenderItem<ItemT> | null | undefined;
  keyExtractor?: ((item: ItemT, index: number) => string) | undefined;
  numColumns?: number | undefined;
  columnWrapperStyle?: StyleProp<ViewStyle> | undefined;
  extraData?: any;
  getItemLayout?: ((data: ArrayLike<ItemT> | null | undefined, index: number) => { length: number; offset: number; index: number }) | undefined;
  initialNumToRender?: number | undefined;
  initialScrollIndex?: number | null | undefined;
  inverted?: boolean | null | undefined;
  ItemSeparatorComponent?: React.ComponentType<any> | null | undefined;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
  ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
  ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
  maxToRenderPerBatch?: number | undefined;
  onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
  onEndReachedThreshold?: number | null | undefined;
  onRefresh?: (() => void) | null | undefined;
  refreshing?: boolean | null | undefined;
  onViewableItemsChanged?: ((info: { viewableItems: ViewToken<ItemT>[]; changed: ViewToken<ItemT>[] }) => void) | null | undefined;
  updateCellsBatchingPeriod?: number | undefined;
  windowSize?: number | undefined;
  fadingEdgeLength?: number | undefined;
  onScrollToIndexFailed?: ((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => void) | undefined;
}
export class FlatList<ItemT = any> extends React.Component<FlatListProps<ItemT>> {
  scrollToEnd(params?: { animated?: boolean | null | undefined }): void;
  scrollToIndex(params: { animated?: boolean | null | undefined; index: number; viewOffset?: number | undefined; viewPosition?: number | undefined }): void;
  scrollToItem(params: { animated?: boolean | null | undefined; item: ItemT; viewOffset?: number | undefined; viewPosition?: number | undefined }): void;
  scrollToOffset(params: { animated?: boolean | null | undefined; offset: number }): void;
  recordInteraction(): void;
  flashScrollIndicators(): void;
}

// ---------------------------------------------------------------- Image
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
export interface ImageLoadEventData {
  source: { height: number; width: number; uri: string };
}
export interface ImageErrorEventData {
  error: any;
}
export interface ImageProps extends AccessibilityProps {
  source?: ImageSourcePropType | undefined;
  src?: string | undefined;
  defaultSource?: ImageURISource | ImageRequireSource | undefined;
  style?: StyleProp<ImageStyle> | undefined;
  resizeMode?: ImageResizeMode | undefined;
  resizeMethod?: 'auto' | 'resize' | 'scale' | 'none' | undefined;
  blurRadius?: number | undefined;
  fadeDuration?: number | undefined;
  progressiveRenderingEnabled?: boolean | undefined;
  tintColor?: ColorValue | undefined;
  onLayout?: ((event: LayoutChangeEvent) => void) | undefined;
  onLoad?: ((event: NativeSyntheticEvent<ImageLoadEventData>) => void) | undefined;
  onLoadEnd?: (() => void) | undefined;
  onLoadStart?: (() => void) | undefined;
  onError?: ((error: NativeSyntheticEvent<ImageErrorEventData>) => void) | undefined;
  onProgress?: ((event: NativeSyntheticEvent<{ loaded: number; total: number }>) => void) | undefined;
  testID?: string | undefined;
  nativeID?: string | undefined;
  alt?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  children?: never;
}
export class Image extends React.Component<ImageProps> {
  static getSize(uri: string, success?: (width: number, height: number) => void, failure?: (error: any) => void): Promise<{ width: number; height: number }>;
  static prefetch(url: string): Promise<boolean>;
}
export interface Image extends NativeMethods {}

// ---------------------------------------------------------------- TextInput
export type ReturnKeyTypeOptions = 'done' | 'go' | 'next' | 'search' | 'send' | 'none' | 'previous' | 'default' | 'emergency-call' | 'google' | 'join' | 'route' | 'yahoo';
export type KeyboardTypeOptions = 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'url' | 'ascii-capable' | 'numbers-and-punctuation' | 'name-phone-pad' | 'twitter' | 'web-search' | 'visible-password';
export interface TextInputProps extends ViewProps {
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
  enterKeyHint?: 'enter' | 'done' | 'next' | 'previous' | 'search' | 'send' | undefined;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | undefined;
  keyboardType?: KeyboardTypeOptions | undefined;
  keyboardAppearance?: 'default' | 'light' | 'dark' | undefined;
  maxLength?: number | undefined;
  multiline?: boolean | undefined;
  numberOfLines?: number | undefined;
  onBlur?: ((e: NativeSyntheticEvent<{ target: number }>) => void) | undefined;
  onChange?: ((e: NativeSyntheticEvent<{ eventCount: number; target: number; text: string }>) => void) | undefined;
  onChangeText?: ((text: string) => void) | undefined;
  onEndEditing?: ((e: NativeSyntheticEvent<{ text: string }>) => void) | undefined;
  onFocus?: ((e: NativeSyntheticEvent<{ target: number }>) => void) | undefined;
  onSubmitEditing?: ((e: NativeSyntheticEvent<{ text: string }>) => void) | undefined;
  onKeyPress?: ((e: NativeSyntheticEvent<{ key: string }>) => void) | undefined;
  placeholder?: string | undefined;
  placeholderTextColor?: ColorValue | undefined;
  returnKeyType?: ReturnKeyTypeOptions | undefined;
  secureTextEntry?: boolean | undefined;
  selectTextOnFocus?: boolean | undefined;
  selectionColor?: ColorValue | undefined;
  spellCheck?: boolean | undefined;
  textContentType?: string | undefined;
  style?: StyleProp<TextStyle> | undefined;
  value?: string | undefined;
  allowFontScaling?: boolean | undefined;
  maxFontSizeMultiplier?: number | null | undefined;
}
export class TextInput extends React.Component<TextInputProps> {
  isFocused(): boolean;
  clear(): void;
  setSelection(start: number, end: number): void;
}
export interface TextInput extends NativeMethods {}

// ---------------------------------------------------------------- Modal / Switch / ActivityIndicator
export interface ModalProps extends ViewProps {
  animated?: boolean | undefined;
  animationType?: 'none' | 'slide' | 'fade' | undefined;
  transparent?: boolean | undefined;
  visible?: boolean | undefined;
  onRequestClose?: ((event: NativeSyntheticEvent<any>) => void) | undefined;
  onShow?: ((event: NativeSyntheticEvent<any>) => void) | undefined;
  onDismiss?: (() => void) | undefined;
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen' | undefined;
  supportedOrientations?: Array<'portrait' | 'portrait-upside-down' | 'landscape' | 'landscape-left' | 'landscape-right'> | undefined;
  statusBarTranslucent?: boolean | undefined;
  navigationBarTranslucent?: boolean | undefined;
  hardwareAccelerated?: boolean | undefined;
  backdropColor?: ColorValue | undefined;
}
export class Modal extends React.Component<ModalProps> {}

export interface SwitchProps extends ViewProps {
  disabled?: boolean | undefined;
  onChange?: ((event: NativeSyntheticEvent<{ value: boolean }>) => Promise<void> | void) | null | undefined;
  onValueChange?: ((value: boolean) => Promise<void> | void) | null | undefined;
  thumbColor?: ColorValue | undefined;
  trackColor?: { false?: ColorValue | null | undefined; true?: ColorValue | null | undefined } | undefined;
  ios_backgroundColor?: ColorValue | undefined;
  value?: boolean | undefined;
}
export class Switch extends React.Component<SwitchProps> {}

export interface ActivityIndicatorProps extends ViewProps {
  animating?: boolean | undefined;
  color?: ColorValue | undefined;
  hidesWhenStopped?: boolean | undefined;
  size?: number | 'small' | 'large' | undefined;
}
export class ActivityIndicator extends React.Component<ActivityIndicatorProps> {}

// ---------------------------------------------------------------- Animated
type ViewClass = typeof View;
type ImageClass = typeof Image;
type TextClass = typeof Text;
type ScrollViewClass = typeof ScrollView;
type EndResult = { finished: boolean; value?: number | undefined };
type EndCallback = (result: EndResult) => void;
type Builtin = Function | Date | Error | RegExp;
type Primitive = string | number | boolean | symbol;
type Nullable = undefined | null;

export namespace Animated {
  type AnimatedValue = Value;
  type AnimatedValueXY = ValueXY;

  class AnimatedNode {
    addListener(callback: (value: any) => any): string;
    removeListener(id: string): void;
    removeAllListeners(): void;
    hasListeners(): boolean;
  }
  class AnimatedWithChildren extends AnimatedNode {}

  type ExtrapolateType = 'extend' | 'identity' | 'clamp';
  type InterpolationConfigType<OutputT extends number | string = number | string> = {
    inputRange: readonly number[];
    outputRange: readonly OutputT[];
    easing?: ((input: number) => number) | undefined;
    extrapolate?: ExtrapolateType | undefined;
    extrapolateLeft?: ExtrapolateType | undefined;
    extrapolateRight?: ExtrapolateType | undefined;
  };
  class AnimatedInterpolation<OutputT extends number | string> extends AnimatedWithChildren {
    interpolate<NewOutputT extends number | string>(config: InterpolationConfigType<NewOutputT>): AnimatedInterpolation<NewOutputT>;
  }

  type ValueListenerCallback = (state: { value: number }) => void;
  class Value extends AnimatedWithChildren {
    constructor(value: number, config?: { useNativeDriver: boolean });
    setValue(value: number): void;
    setOffset(offset: number): void;
    flattenOffset(): void;
    extractOffset(): void;
    addListener(callback: ValueListenerCallback): string;
    stopAnimation(callback?: (value: number) => void): void;
    resetAnimation(callback?: (value: number) => void): void;
    interpolate<OutputT extends number | string>(config: InterpolationConfigType<OutputT>): AnimatedInterpolation<OutputT>;
  }
  class ValueXY extends AnimatedWithChildren {
    x: Value;
    y: Value;
    constructor(valueIn?: { x: number | Value; y: number | Value }, config?: { useNativeDriver: boolean });
    setValue(value: { x: number; y: number }): void;
    stopAnimation(callback?: (value: { x: number; y: number }) => void): void;
    getLayout(): { [key: string]: Value };
    getTranslateTransform(): Array<{ translateX: Value } | { translateY: Value }>;
  }

  interface CompositeAnimation {
    start: (callback?: EndCallback) => void;
    stop: () => void;
    reset: () => void;
  }

  interface AnimationConfig {
    isInteraction?: boolean | undefined;
    useNativeDriver: boolean;
  }
  interface TimingAnimationConfig extends AnimationConfig {
    toValue: number | Value | { x: number; y: number } | ValueXY | AnimatedInterpolation<number>;
    easing?: ((value: number) => number) | undefined;
    duration?: number | undefined;
    delay?: number | undefined;
  }
  interface SpringAnimationConfig extends AnimationConfig {
    toValue: number | Value | { x: number; y: number } | ValueXY | AnimatedInterpolation<number>;
    overshootClamping?: boolean | undefined;
    restDisplacementThreshold?: number | undefined;
    restSpeedThreshold?: number | undefined;
    velocity?: number | { x: number; y: number } | undefined;
    bounciness?: number | undefined;
    speed?: number | undefined;
    tension?: number | undefined;
    friction?: number | undefined;
    stiffness?: number | undefined;
    mass?: number | undefined;
    damping?: number | undefined;
    delay?: number | undefined;
  }
  interface DecayAnimationConfig extends AnimationConfig {
    velocity: number | { x: number; y: number };
    deceleration?: number | undefined;
  }
  interface LoopAnimationConfig {
    iterations?: number | undefined;
    resetBeforeIteration?: boolean | undefined;
  }
  interface ParallelConfig {
    stopTogether?: boolean | undefined;
  }

  function timing(value: Value | ValueXY, config: TimingAnimationConfig): CompositeAnimation;
  function spring(value: Value | ValueXY, config: SpringAnimationConfig): CompositeAnimation;
  function decay(value: Value | ValueXY, config: DecayAnimationConfig): CompositeAnimation;
  function delay(time: number): CompositeAnimation;
  function sequence(animations: Array<CompositeAnimation>): CompositeAnimation;
  function parallel(animations: Array<CompositeAnimation>, config?: ParallelConfig): CompositeAnimation;
  function stagger(time: number, animations: Array<CompositeAnimation>): CompositeAnimation;
  function loop(animation: CompositeAnimation, config?: LoopAnimationConfig): CompositeAnimation;

  type AnimatedOperand = Value | AnimatedInterpolation<number> | number | AnimatedWithChildren;
  function add(a: AnimatedOperand, b: AnimatedOperand): AnimatedInterpolation<number>;
  function subtract(a: AnimatedOperand, b: AnimatedOperand): AnimatedInterpolation<number>;
  function divide(a: AnimatedOperand, b: AnimatedOperand): AnimatedInterpolation<number>;
  function multiply(a: AnimatedOperand, b: AnimatedOperand): AnimatedInterpolation<number>;
  function modulo(a: AnimatedOperand, modulus: number): AnimatedInterpolation<number>;
  function diffClamp(a: AnimatedOperand, min: number, max: number): AnimatedInterpolation<number>;

  type Mapping = { [key: string]: Mapping } | Value;
  interface EventConfig<T> {
    listener?: ((event: NativeSyntheticEvent<T>) => void) | undefined;
    useNativeDriver: boolean;
  }
  function event<T = any>(argMapping: Array<Mapping | null>, config?: EventConfig<T>): (...args: any[]) => void;

  type WithAnimatedArray<P> = Array<WithAnimatedValue<P>> | ReadonlyArray<WithAnimatedValue<P>>;
  type WithAnimatedObject<T> = { [K in keyof T]: WithAnimatedValue<T[K]> };
  type WithAnimatedValue<T> = T extends Builtin | Nullable
    ? T
    : T extends Primitive
      ? T | Value | AnimatedInterpolation<number | string>
      : T extends Array<infer P>
        ? WithAnimatedArray<P>
        : T extends {}
          ? WithAnimatedObject<T>
          : T;
  type NonAnimatedProps = 'key' | 'ref';
  type AnimatedProps<T> = {
    [key in keyof T]: key extends NonAnimatedProps ? T[key] : WithAnimatedValue<T[key]>;
  };
  interface AnimatedComponent<T extends React.ComponentType<any>>
    extends React.FC<AnimatedProps<React.ComponentPropsWithRef<T>>> {}

  function createAnimatedComponent<T extends React.ComponentType<any>>(component: T): AnimatedComponent<T>;

  const View: AnimatedComponent<ViewClass>;
  const Image: AnimatedComponent<ImageClass>;
  const Text: AnimatedComponent<TextClass>;
  const ScrollView: AnimatedComponent<ScrollViewClass>;
  class FlatList<ItemT = any> extends React.Component<AnimatedProps<FlatListProps<ItemT>>> {
    scrollToEnd(params?: { animated?: boolean | null | undefined }): void;
    scrollToIndex(params: { animated?: boolean | null | undefined; index: number; viewOffset?: number | undefined; viewPosition?: number | undefined }): void;
    scrollToOffset(params: { animated?: boolean | null | undefined; offset: number }): void;
  }
}

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
  elastic(bounciness: number): EasingFunction;
  back(s: number): EasingFunction;
  bounce: EasingFunction;
  bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction;
  in(easing: EasingFunction): EasingFunction;
  out(easing: EasingFunction): EasingFunction;
  inOut(easing: EasingFunction): EasingFunction;
}
export const Easing: EasingStatic;

// ---------------------------------------------------------------- LayoutAnimation
export type LayoutAnimationType = 'spring' | 'linear' | 'easeInEaseOut' | 'easeIn' | 'easeOut' | 'keyboard';
export type LayoutAnimationProperty = 'opacity' | 'scaleX' | 'scaleY' | 'scaleXY';
export interface LayoutAnimationAnim {
  duration?: number | undefined;
  delay?: number | undefined;
  springDamping?: number | undefined;
  initialVelocity?: number | undefined;
  type?: LayoutAnimationType | undefined;
  property?: LayoutAnimationProperty | undefined;
}
export interface LayoutAnimationConfig {
  duration: number;
  create?: LayoutAnimationAnim | undefined;
  update?: LayoutAnimationAnim | undefined;
  delete?: LayoutAnimationAnim | undefined;
}
export interface LayoutAnimationStatic {
  configureNext: (config: LayoutAnimationConfig, onAnimationDidEnd?: () => void, onAnimationDidFail?: () => void) => void;
  create: (duration: number, type?: LayoutAnimationType, creationProp?: LayoutAnimationProperty) => LayoutAnimationConfig;
  Types: { [type in LayoutAnimationType]: type };
  Properties: { [prop in LayoutAnimationProperty]: prop };
  Presets: { easeInEaseOut: LayoutAnimationConfig; linear: LayoutAnimationConfig; spring: LayoutAnimationConfig };
  easeInEaseOut: (onAnimationDidEnd?: () => void) => void;
  linear: (onAnimationDidEnd?: () => void) => void;
  spring: (onAnimationDidEnd?: () => void) => void;
}
export const LayoutAnimation: LayoutAnimationStatic;

// ---------------------------------------------------------------- platform modules
export interface EmitterSubscription {
  remove(): void;
}
export type NativeEventSubscription = EmitterSubscription;

export interface AccessibilityChangeEventHandlers {
  change: (isScreenReaderEnabled: boolean) => void;
  boldTextChanged: (isBoldTextEnabled: boolean) => void;
  grayscaleChanged: (isGrayscaleEnabled: boolean) => void;
  invertColorsChanged: (isInvertColorsEnabled: boolean) => void;
  reduceMotionChanged: (isReduceMotionEnabled: boolean) => void;
  highTextContrastChanged: (isHighTextContrastEnabled: boolean) => void;
  darkerSystemColorsChanged: (isDarkerSystemColorsEnabled: boolean) => void;
  screenReaderChanged: (isScreenReaderEnabled: boolean) => void;
  reduceTransparencyChanged: (isReduceTransparencyEnabled: boolean) => void;
  announcementFinished: (event: { announcement: string; success: boolean }) => void;
}
export interface AccessibilityInfoStatic {
  isBoldTextEnabled(): Promise<boolean>;
  isGrayscaleEnabled(): Promise<boolean>;
  isInvertColorsEnabled(): Promise<boolean>;
  isReduceMotionEnabled(): Promise<boolean>;
  isHighTextContrastEnabled(): Promise<boolean>;
  isDarkerSystemColorsEnabled(): Promise<boolean>;
  prefersCrossFadeTransitions(): Promise<boolean>;
  isReduceTransparencyEnabled(): Promise<boolean>;
  isScreenReaderEnabled(): Promise<boolean>;
  isAccessibilityServiceEnabled(): Promise<boolean>;
  addEventListener<K extends keyof AccessibilityChangeEventHandlers>(eventName: K, handler: AccessibilityChangeEventHandlers[K]): EmitterSubscription;
  setAccessibilityFocus(reactTag: number): void;
  announceForAccessibility(announcement: string): void;
  announceForAccessibilityWithOptions(announcement: string, options: { queue?: boolean | undefined }): void;
  getRecommendedTimeoutMillis(originalTimeout: number): Promise<number>;
}
export const AccessibilityInfo: AccessibilityInfoStatic;

export interface AlertButton {
  text?: string | undefined;
  onPress?: ((value?: string) => void) | ((value?: { login: string; password: string }) => void) | undefined;
  isPreferred?: boolean | undefined;
  style?: 'default' | 'cancel' | 'destructive' | undefined;
}
export interface AlertOptions {
  cancelable?: boolean | undefined;
  userInterfaceStyle?: 'unspecified' | 'light' | 'dark' | undefined;
  onDismiss?: (() => void) | undefined;
}
export interface AlertStatic {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
  prompt: (title: string, message?: string, callbackOrButtons?: ((text: string) => void) | AlertButton[], type?: string, defaultValue?: string, keyboardType?: string) => void;
}
export const Alert: AlertStatic;

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
export type AppStateEvent = 'change' | 'memoryWarning' | 'blur' | 'focus';
export interface AppStateStatic {
  currentState: AppStateStatus;
  isAvailable: boolean;
  addEventListener(type: AppStateEvent, listener: (state: AppStateStatus) => void): NativeEventSubscription;
}
export const AppState: AppStateStatic;

export type BackPressEventName = 'hardwareBackPress';
export interface BackHandlerStatic {
  exitApp(): void;
  addEventListener(eventName: BackPressEventName, handler: () => boolean | null | undefined): NativeEventSubscription;
}
export const BackHandler: BackHandlerStatic;

export interface DevSettingsStatic {
  addMenuItem(title: string, handler: () => any): void;
  reload(reason?: string): void;
}
export const DevSettings: DevSettingsStatic;

export interface I18nManagerStatic {
  getConstants: () => { isRTL: boolean; doLeftAndRightSwapInRTL: boolean; localeIdentifier?: string | null | undefined };
  isRTL: boolean;
  doLeftAndRightSwapInRTL: boolean;
  allowRTL: (allowRTL: boolean) => void;
  forceRTL: (forceRTL: boolean) => void;
  swapLeftAndRightInRTL: (swapLeftAndRight: boolean) => void;
}
export const I18nManager: I18nManagerStatic;

export interface KeyboardStatic {
  dismiss(): void;
  addListener(eventType: string, listener: (event: any) => void): EmitterSubscription;
  isVisible(): boolean;
}
export const Keyboard: KeyboardStatic;

export interface LinkingStatic {
  addEventListener(type: 'url', handler: (event: { url: string }) => void): EmitterSubscription;
  openURL(url: string): Promise<any>;
  canOpenURL(url: string): Promise<boolean>;
  getInitialURL(): Promise<string | null>;
  openSettings(): Promise<void>;
  sendIntent(action: string, extras?: Array<{ key: string; value: string | number | boolean }>): Promise<void>;
}
export const Linking: LinkingStatic;

export type ShareContent = { title?: string | undefined; url: string; message?: string | undefined } | { title?: string | undefined; url?: string | undefined; message: string };
export type ShareOptions = {
  dialogTitle?: string | undefined;
  excludedActivityTypes?: Array<string> | undefined;
  tintColor?: ColorValue | undefined;
  subject?: string | undefined;
  anchor?: number | undefined;
};
export type ShareAction = { action: 'sharedAction' | 'dismissedAction'; activityType?: string | null | undefined };
export interface ShareStatic {
  share(content: ShareContent, options?: ShareOptions): Promise<ShareAction>;
  sharedAction: 'sharedAction';
  dismissedAction: 'dismissedAction';
}
export const Share: ShareStatic;

export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'native';
export interface PlatformStatic {
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

export interface UIManagerStatic {
  setLayoutAnimationEnabledExperimental?: ((value: boolean) => void) | undefined;
  [key: string]: unknown;
}
export const UIManager: UIManagerStatic;

export type ColorSchemeName = 'light' | 'dark' | 'unspecified' | null | undefined;
export function useColorScheme(): ColorSchemeName;
export interface AppearancePreferences {
  colorScheme: ColorSchemeName;
}
export interface AppearanceStatic {
  getColorScheme(): ColorSchemeName;
  /** RN 0.81: 'unspecified' (or null) hands the scheme back to the system. Added by T33; unverified offline. */
  setColorScheme(scheme: ColorSchemeName): void;
  addChangeListener(listener: (preferences: AppearancePreferences) => void): EmitterSubscription;
}
export const Appearance: AppearanceStatic;
export interface ScaledSize {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}
export function useWindowDimensions(): ScaledSize;
export interface DimensionsStatic {
  get(dim: 'window' | 'screen'): ScaledSize;
  addEventListener(type: 'change', handler: (dims: { window: ScaledSize; screen: ScaledSize }) => void): EmitterSubscription;
}
export const Dimensions: DimensionsStatic;
export const PixelRatio: {
  get(): number;
  getFontScale(): number;
  getPixelSizeForLayoutSize(layoutSize: number): number;
  roundToNearestPixel(layoutSize: number): number;
};
export function processColor(color?: number | ColorValue): number | null | undefined;
export function PlatformColor(...colors: string[]): OpaqueColorValue;

// react-native/types/modules/globals.d.ts
declare global {
  const __DEV__: boolean;
}
