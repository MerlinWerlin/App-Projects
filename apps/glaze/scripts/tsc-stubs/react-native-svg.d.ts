// Hand-written approximation of react-native-svg 15.12 for the cloud strict-tsc harness (D74-3).

declare module 'react-native-svg' {
  import type { Component, ReactNode } from 'react';
  import type { ViewProps, ColorValue, GestureResponderEvent, ImageSourcePropType, LayoutChangeEvent } from 'react-native';

  export type NumberProp = string | number;
  export type NumberArray = NumberProp[] | NumberProp;
  export type FillRule = 'evenodd' | 'nonzero';
  export type Linecap = 'butt' | 'square' | 'round';
  export type Linejoin = 'miter' | 'bevel' | 'round';
  export type TextAnchor = 'start' | 'middle' | 'end';
  export type FontWeight = NumberProp | 'normal' | 'bold' | 'bolder' | 'lighter' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

  export interface CommonPathProps {
    fill?: ColorValue;
    fillOpacity?: NumberProp;
    fillRule?: FillRule;
    stroke?: ColorValue;
    strokeWidth?: NumberProp;
    strokeOpacity?: NumberProp;
    strokeDasharray?: ReadonlyArray<NumberProp> | NumberProp;
    strokeDashoffset?: NumberProp;
    strokeLinecap?: Linecap;
    strokeLinejoin?: Linejoin;
    strokeMiterlimit?: NumberProp;
    vectorEffect?: 'none' | 'non-scaling-stroke' | 'nonScalingStroke' | 'default' | 'inherit' | 'uri';
    clipRule?: FillRule;
    clipPath?: string;
    mask?: string;
    marker?: string;
    markerStart?: string;
    markerMid?: string;
    markerEnd?: string;
    filter?: string;
    opacity?: NumberProp;
    transform?: string | ReadonlyArray<object> | object;
    origin?: NumberArray;
    originX?: NumberProp;
    originY?: NumberProp;
    translate?: NumberArray;
    translateX?: NumberProp;
    translateY?: NumberProp;
    scale?: NumberArray;
    scaleX?: NumberProp;
    scaleY?: NumberProp;
    rotation?: NumberProp;
    skewX?: NumberProp;
    skewY?: NumberProp;
    x?: NumberProp;
    y?: NumberProp;
    id?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    onPress?: (event: GestureResponderEvent) => void;
    onLayout?: (event: LayoutChangeEvent) => void;
    testID?: string;
    accessibilityLabel?: string;
    accessible?: boolean;
    children?: ReactNode;
    color?: ColorValue;
    display?: 'none' | 'inline';
  }

  export interface SvgProps extends ViewProps {
    width?: NumberProp;
    height?: NumberProp;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: ColorValue;
    title?: string;
    fill?: ColorValue;
    stroke?: ColorValue;
    strokeWidth?: NumberProp;
    opacity?: NumberProp;
    children?: ReactNode;
  }
  export class Svg extends Component<SvgProps> {
    toDataURL(callback: (base64: string) => void, options?: object): void;
  }
  export default Svg;

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
  export interface RectProps extends CommonPathProps {
    width?: NumberProp;
    height?: NumberProp;
    rx?: NumberProp;
    ry?: NumberProp;
  }
  export class Rect extends Component<RectProps> {}
  export interface LineProps extends CommonPathProps {
    x1?: NumberProp;
    x2?: NumberProp;
    y1?: NumberProp;
    y2?: NumberProp;
  }
  export class Line extends Component<LineProps> {}
  export interface PathProps extends CommonPathProps {
    d?: string;
  }
  export class Path extends Component<PathProps> {}
  export interface PolygonProps extends CommonPathProps {
    points?: string | ReadonlyArray<NumberProp>;
  }
  export class Polygon extends Component<PolygonProps> {}
  export class Polyline extends Component<PolygonProps> {}
  export interface GProps extends CommonPathProps {
    fontSize?: NumberProp;
    fontWeight?: FontWeight;
    fontFamily?: string;
  }
  export class G extends Component<GProps> {}
  export class Defs extends Component<{ children?: ReactNode }> {}
  export interface ClipPathProps {
    id?: string;
    children?: ReactNode;
    clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }
  export class ClipPath extends Component<ClipPathProps> {}
  export interface MaskProps extends CommonPathProps {
    width?: NumberProp;
    height?: NumberProp;
    maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }
  export class Mask extends Component<MaskProps> {}
  export interface StopProps {
    stopColor?: ColorValue;
    stopOpacity?: NumberProp;
    offset?: NumberProp;
    children?: ReactNode;
  }
  export class Stop extends Component<StopProps> {}
  export interface LinearGradientProps {
    x1?: NumberProp;
    x2?: NumberProp;
    y1?: NumberProp;
    y2?: NumberProp;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    gradientTransform?: string | ReadonlyArray<object> | object;
    id?: string;
    children?: ReactNode;
  }
  export class LinearGradient extends Component<LinearGradientProps> {}
  export interface RadialGradientProps {
    fx?: NumberProp;
    fy?: NumberProp;
    rx?: NumberProp;
    ry?: NumberProp;
    cx?: NumberProp;
    cy?: NumberProp;
    r?: NumberProp;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    gradientTransform?: string | ReadonlyArray<object> | object;
    id?: string;
    children?: ReactNode;
  }
  export class RadialGradient extends Component<RadialGradientProps> {}
  export interface ImageProps extends CommonPathProps {
    width?: NumberProp;
    height?: NumberProp;
    href?: ImageSourcePropType | string;
    xlinkHref?: ImageSourcePropType | string;
    preserveAspectRatio?: string;
    onLoad?: (e: any) => void;
    onError?: (e: any) => void;
  }
  export class Image extends Component<ImageProps> {}
  export interface TextProps extends CommonPathProps {
    dx?: NumberArray;
    dy?: NumberArray;
    fontSize?: NumberProp;
    fontWeight?: FontWeight;
    fontFamily?: string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    letterSpacing?: NumberProp;
    textAnchor?: TextAnchor;
    alignmentBaseline?: string;
    baselineShift?: NumberProp;
    inlineSize?: NumberProp;
  }
  export class Text extends Component<TextProps> {}
  export class TSpan extends Component<TextProps> {}
  export interface PatternProps {
    id?: string;
    x?: NumberProp;
    y?: NumberProp;
    width?: NumberProp;
    height?: NumberProp;
    patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    patternTransform?: string | ReadonlyArray<object> | object;
    viewBox?: string;
    preserveAspectRatio?: string;
    children?: ReactNode;
  }
  export class Pattern extends Component<PatternProps> {}
  export class Use extends Component<CommonPathProps & { href?: string; xlinkHref?: string; width?: NumberProp; height?: NumberProp }> {}
  export class Symbol extends Component<{ id?: string; viewBox?: string; preserveAspectRatio?: string; children?: ReactNode }> {}
  export function SvgXml(props: SvgProps & { xml: string | null; override?: object }): import('react').ReactElement | null;
}
