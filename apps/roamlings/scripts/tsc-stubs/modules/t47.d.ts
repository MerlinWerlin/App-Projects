// Stubs added by T47 (offline city maps), merged into the existing module declarations. Hand-written from the
// published APIs: react-native-maps 1.29 (lib/MapLocalTile.d.ts, lib/MapView.d.ts min/maxZoomLevel) and
// expo-file-system SDK 58 legacy (build/legacy/FileSystem.d.ts, FileSystem.types.d.ts: createDownloadResumable).
declare module 'react-native-maps' {
  import type { Component } from 'react';
  import type { ViewProps } from 'react-native';

  export type MapLocalTileProps = ViewProps & {
    /** File path of the tiles with {z}, {x} and {y} placeholders. */
    pathTemplate: string;
    tileSize?: number;
    zIndex?: number;
    /** Android only: read tiles from the app's assets. */
    useAssets?: boolean;
  };
  export class LocalTile extends Component<MapLocalTileProps> {}

  export interface MapViewProps {
    minZoomLevel?: number;
    maxZoomLevel?: number;
  }
}

declare module 'expo-file-system/legacy' {
  export type DownloadProgressData = { totalBytesWritten: number; totalBytesExpectedToWrite: number };
  export type DownloadProgressCallback = (data: DownloadProgressData) => void;
  export type DownloadOptions = { md5?: boolean; cache?: boolean; headers?: Record<string, string> };
  export type FileSystemDownloadResult = { uri: string; status: number; headers: Record<string, string>; mimeType: string | null; md5?: string };
  export type DownloadPauseState = { url: string; fileUri: string; options: DownloadOptions; resumeData?: string };
  export class DownloadResumable {
    downloadAsync(): Promise<FileSystemDownloadResult | undefined>;
    pauseAsync(): Promise<DownloadPauseState>;
    resumeAsync(): Promise<FileSystemDownloadResult | undefined>;
    cancelAsync(): Promise<void>;
    savable(): DownloadPauseState;
    get fileUri(): string;
  }
  export function createDownloadResumable(
    uri: string,
    fileUri: string,
    options?: DownloadOptions,
    callback?: DownloadProgressCallback,
    resumeData?: string,
  ): DownloadResumable;
}
