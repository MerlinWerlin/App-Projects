// Stubs added by T69 (trip on the map), merged into the existing module declaration. Hand-written from the
// published API of react-native-maps 1.29 (lib/MapPolyline.d.ts; lib/MapMarker.d.ts anchor / zIndex). Only the
// members Satchel uses.
declare module 'react-native-maps' {
  import type { Component } from 'react';
  import type { ColorValue, ViewProps } from 'react-native';

  export interface MapPolylineProps extends ViewProps {
    coordinates: LatLng[];
    strokeColor?: ColorValue;
    strokeWidth?: number;
    /** Lengths of painted and unpainted segments, alternating. */
    lineDashPattern?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
    geodesic?: boolean;
    tappable?: boolean;
    zIndex?: number;
  }
  export class Polyline extends Component<MapPolylineProps> {}

  export interface MapMarkerProps {
    /** Point of the marker view placed on the coordinate, 0..1 from the top left. */
    anchor?: { x: number; y: number };
    zIndex?: number;
  }
}
