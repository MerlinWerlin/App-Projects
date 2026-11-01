// Stubs added by T73 (find your way back), merged into the existing expo-location declaration (t09.d.ts).
// Hand-written from the published API of expo-location (build/Location.d.ts watchPositionAsync / watchHeadingAsync,
// build/Location.types.d.ts LocationHeadingObject, LocationSubscription, LocationCallback). Only what Satchel uses.
declare module 'expo-location' {
  /** Heading reading. trueHeading is -1 when it can't be worked out; accuracy is a calibration level 0..3. */
  export type LocationHeadingObject = { trueHeading: number; magHeading: number; accuracy: number };
  export type LocationHeadingCallback = (location: LocationHeadingObject) => any;
  export type LocationCallback = (location: LocationObject) => any;
  export type LocationErrorCallback = (reason: string) => void;
  export type LocationSubscription = { remove: () => void };
  export function watchPositionAsync(options: LocationOptions, callback: LocationCallback, errorHandler?: LocationErrorCallback): Promise<LocationSubscription>;
  export function watchHeadingAsync(callback: LocationHeadingCallback, errorHandler?: LocationErrorCallback): Promise<LocationSubscription>;
}
