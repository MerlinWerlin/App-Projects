// Stubs added by T09 for the modules it imports (see ../README.md). Hand-written from the published APIs:
// react-native-maps 1.26 (lib/MapView.d.ts, lib/MapMarker.d.ts, lib/sharedTypes.d.ts) and expo-location SDK 57
// (build/Location.d.ts, build/Location.types.d.ts). Only the members Satchel uses.
declare module 'react-native-maps' {
  import type { Component, ReactNode } from 'react';
  import type { ColorValue, NativeSyntheticEvent, ViewProps } from 'react-native';

  export type LatLng = { latitude: number; longitude: number };
  export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
  export type EdgePadding = { top: number; right: number; bottom: number; left: number };
  export type Provider = 'google' | undefined;
  export type MapPressEvent = NativeSyntheticEvent<{ coordinate: LatLng; position: { x: number; y: number }; action?: string; id?: string }>;
  export type MarkerPressEvent = NativeSyntheticEvent<{ action: 'marker-press'; id: string; coordinate: LatLng; position?: { x: number; y: number } }>;

  export interface MapViewProps extends ViewProps {
    provider?: Provider | null;
    initialRegion?: Region;
    region?: Region;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsPointsOfInterest?: boolean;
    showsCompass?: boolean;
    toolbarEnabled?: boolean;
    loadingEnabled?: boolean;
    rotateEnabled?: boolean;
    pitchEnabled?: boolean;
    userInterfaceStyle?: 'light' | 'dark';
    onMapReady?: () => void;
    onPress?: (event: MapPressEvent) => void;
    onRegionChangeComplete?: (region: Region, details: { isGesture?: boolean }) => void;
    children?: ReactNode;
  }
  export default class MapView extends Component<MapViewProps> {
    animateToRegion(region: Region, duration?: number): void;
    fitToCoordinates(coordinates?: LatLng[], options?: { edgePadding?: EdgePadding; animated?: boolean }): void;
  }

  export interface MapMarkerProps extends ViewProps {
    coordinate: LatLng;
    identifier?: string;
    title?: string;
    description?: string;
    pinColor?: ColorValue;
    tracksViewChanges?: boolean;
    onPress?: (event: MarkerPressEvent) => void;
    children?: ReactNode;
  }
  export class Marker extends Component<MapMarkerProps> {}
  export const PROVIDER_DEFAULT: undefined;
  export const PROVIDER_GOOGLE: 'google';
}

declare module 'expo-location' {
  export enum Accuracy {
    Lowest = 1,
    Low = 2,
    Balanced = 3,
    High = 4,
    Highest = 5,
    BestForNavigation = 6,
  }
  export enum PermissionStatus {
    DENIED = 'denied',
    GRANTED = 'granted',
    UNDETERMINED = 'undetermined',
  }
  export type LocationPermissionResponse = {
    status: PermissionStatus;
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never' | number;
  };
  export type LocationObjectCoords = {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  export type LocationObject = { coords: LocationObjectCoords; timestamp: number; mocked?: boolean };
  export type LocationOptions = { accuracy?: Accuracy; mayShowUserSettingsDialog?: boolean; timeInterval?: number; distanceInterval?: number };
  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function getForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function hasServicesEnabledAsync(): Promise<boolean>;
  export function getCurrentPositionAsync(options?: LocationOptions): Promise<LocationObject>;
}
