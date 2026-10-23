// Hand-written approximations of the Expo SDK 54 modules Glaze imports, for the cloud strict-tsc
// harness (D74-3). Public API shapes only; permissive where the real types are large.

declare module 'expo' {
  export function requireOptionalNativeModule<ModuleType = any>(moduleName: string): ModuleType | null;
  export function requireNativeModule<ModuleType = any>(moduleName: string): ModuleType;
  export function requireNativeViewManager<P = any>(viewName: string): import('react').ComponentType<P>;
  export class EventEmitter<T extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>> {
    addListener<K extends keyof T>(eventName: K, listener: T[K]): { remove(): void };
    removeAllListeners(eventName: keyof T): void;
    emit<K extends keyof T>(eventName: K, ...args: Parameters<T[K]>): void;
  }
  export class NativeModule<T extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>> extends EventEmitter<T> {}
  export class SharedObject<T extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>> extends EventEmitter<T> {
    release(): void;
  }
  export function registerRootComponent(component: import('react').ComponentType<any>): void;
}

declare module 'expo-router' {
  import type { ComponentType, ReactNode, ReactElement } from 'react';
  import type { StyleProp, ViewStyle, TextStyle, ColorValue } from 'react-native';

  // Typed routes are not generated in the cloud, so hrefs are plain strings or objects.
  export type Href = string | { pathname: string; params?: Record<string, string | number | boolean | undefined | null | (string | number)[]> };
  export type UnknownOutputParams = Record<string, string | string[]>;
  export interface NavigationOptions {
    relativeToDirectory?: boolean;
    withAnchor?: boolean;
    dangerouslySingular?: boolean | ((name: string, params: UnknownOutputParams) => string | undefined);
  }
  export interface Router {
    push(href: Href, options?: NavigationOptions): void;
    navigate(href: Href, options?: NavigationOptions): void;
    replace(href: Href, options?: NavigationOptions): void;
    back(): void;
    canGoBack(): boolean;
    dismiss(count?: number): void;
    dismissAll(): void;
    dismissTo(href: Href, options?: NavigationOptions): void;
    canDismiss(): boolean;
    setParams(params: Record<string, string | number | undefined | null | (string | number)[]>): void;
    prefetch(href: Href): void;
  }
  export const router: Router;
  export function useRouter(): Router;
  export function useLocalSearchParams<
    TParams extends Record<string, string | string[] | undefined> = UnknownOutputParams,
  >(): Partial<TParams> & TParams;
  export function useGlobalSearchParams<
    TParams extends Record<string, string | string[] | undefined> = UnknownOutputParams,
  >(): Partial<TParams> & TParams;
  export function useFocusEffect(effect: () => void | (() => void), do_not_pass_a_second_prop?: undefined): void;
  export function usePathname(): string;
  export function useSegments(): string[];
  export function useNavigation<T = any>(parent?: string): T;
  export function useRootNavigationState(): any;

  export interface ErrorBoundaryProps {
    error: Error;
    retry: () => Promise<void>;
  }
  export function Redirect(props: { href: Href; relativeToDirectory?: boolean; withAnchor?: boolean }): ReactElement | null;
  export interface LinkProps {
    href: Href;
    asChild?: boolean;
    replace?: boolean;
    push?: boolean;
    children?: ReactNode;
    style?: StyleProp<TextStyle>;
    onPress?: (e: any) => void;
    accessibilityLabel?: string;
    [key: string]: unknown;
  }
  export const Link: ComponentType<LinkProps>;

  type HeaderOptionsBase = {
    title?: string;
    headerShown?: boolean;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
    headerTitleAlign?: 'left' | 'center';
    headerTitleStyle?: StyleProp<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight'> & { color?: string }>;
    headerStyle?: StyleProp<{ backgroundColor?: string }>;
    headerTintColor?: string;
    headerShadowVisible?: boolean;
    headerTransparent?: boolean;
    headerBackTitle?: string;
    headerLeft?: (props: { tintColor?: string; canGoBack?: boolean; label?: string }) => ReactNode;
    headerRight?: (props: { tintColor?: string; canGoBack?: boolean }) => ReactNode;
  };
  export type StackNavigationOptions = HeaderOptionsBase & {
    contentStyle?: StyleProp<ViewStyle>;
    animation?:
      | 'default' | 'fade' | 'fade_from_bottom' | 'flip' | 'simple_push' | 'slide_from_bottom'
      | 'slide_from_right' | 'slide_from_left' | 'ios_from_right' | 'ios_from_left' | 'none';
    animationDuration?: number;
    gestureEnabled?: boolean;
    fullScreenGestureEnabled?: boolean;
    presentation?: 'card' | 'modal' | 'transparentModal' | 'containedModal' | 'containedTransparentModal' | 'fullScreenModal' | 'formSheet';
    headerLargeTitle?: boolean;
    headerBackButtonDisplayMode?: 'default' | 'generic' | 'minimal';
    headerBlurEffect?: string;
    statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
    orientation?: string;
    sheetAllowedDetents?: number[] | 'fitToContents';
    sheetGrabberVisible?: boolean;
    sheetCornerRadius?: number;
    [key: string]: unknown;
  };
  export type BottomTabNavigationOptions = HeaderOptionsBase & {
    href?: Href | null;
    tabBarLabel?: string | ((props: { focused: boolean; color: string; position: string; children: string }) => ReactNode);
    tabBarShowLabel?: boolean;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
    tabBarBadge?: number | string;
    tabBarBadgeStyle?: StyleProp<TextStyle>;
    tabBarAccessibilityLabel?: string;
    tabBarButtonTestID?: string;
    tabBarButton?: (props: any) => ReactNode;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    tabBarActiveBackgroundColor?: string;
    tabBarInactiveBackgroundColor?: string;
    tabBarAllowFontScaling?: boolean;
    tabBarLabelStyle?: StyleProp<TextStyle>;
    tabBarIconStyle?: StyleProp<TextStyle>;
    tabBarItemStyle?: StyleProp<ViewStyle>;
    tabBarStyle?: StyleProp<ViewStyle>;
    tabBarBackground?: () => ReactNode;
    tabBarHideOnKeyboard?: boolean;
    tabBarLabelPosition?: 'beside-icon' | 'below-icon';
    tabBarVariant?: 'uikit' | 'material';
    tabBarPosition?: 'bottom' | 'left' | 'right' | 'top';
    sceneStyle?: StyleProp<ViewStyle>;
    animation?: 'fade' | 'shift' | 'none';
    lazy?: boolean;
    freezeOnBlur?: boolean;
    popToTopOnBlur?: boolean;
    unmountOnBlur?: boolean;
    [key: string]: unknown;
  };
  type ScreenProps<O> = {
    name?: string;
    options?: O | ((props: { route: any; navigation: any }) => O);
    initialParams?: Record<string, unknown>;
    redirect?: boolean;
    listeners?: Record<string, (e: any) => void> | ((props: any) => Record<string, (e: any) => void>);
    getId?: (props: { params?: Record<string, any> }) => string | undefined;
    dangerouslySingular?: boolean;
    children?: ReactNode;
  };
  type NavigatorProps<O> = {
    screenOptions?: O | ((props: { route: any; navigation: any }) => O);
    initialRouteName?: string;
    screenListeners?: any;
    backBehavior?: 'firstRoute' | 'initialRoute' | 'order' | 'history' | 'fullHistory' | 'none';
    tabBar?: (props: any) => ReactNode;
    children?: ReactNode;
    id?: string;
  };
  export const Stack: ((props: NavigatorProps<StackNavigationOptions>) => ReactElement | null) & {
    Screen: (props: ScreenProps<StackNavigationOptions>) => null;
    Protected: (props: { guard: boolean; children?: ReactNode }) => null;
  };
  export const Tabs: ((props: NavigatorProps<BottomTabNavigationOptions>) => ReactElement | null) & {
    Screen: (props: ScreenProps<BottomTabNavigationOptions>) => null;
    Protected: (props: { guard: boolean; children?: ReactNode }) => null;
  };
  export const Slot: ComponentType<{}>;
  export function SplashScreen(): null;
}

declare module 'expo-router/entry' {}

declare module '@expo/vector-icons' {
  import type { Component } from 'react';
  import type { TextProps, ColorValue, OpaqueColorValue } from 'react-native';
  import type { FeatherGlyphName } from '@expo/vector-icons/feather-names';

  export interface IconProps<GLYPHS extends string> extends TextProps {
    name: GLYPHS;
    size?: number;
    color?: string | OpaqueColorValue;
  }
  interface IconComponent<G extends string> {
    new (props: IconProps<G>): Component<IconProps<G>>;
    glyphMap: Record<G, number | string>;
    font: { [fontName: string]: any };
    loadFont(): Promise<void>;
    hasIcon(name: string): boolean;
  }
  export const Feather: IconComponent<FeatherGlyphName>;
  // Ionicons has ~1,300 names; kept as string (permissive) in the stub.
  export const Ionicons: IconComponent<string>;
  export const MaterialIcons: IconComponent<string>;
  export const MaterialCommunityIcons: IconComponent<string>;
}

declare module 'expo-constants' {
  export type ExecutionEnvironment = 'bare' | 'standalone' | 'storeClient';
  export const ExecutionEnvironment: { Bare: 'bare'; Standalone: 'standalone'; StoreClient: 'storeClient' };
  export interface ExpoConfig {
    name: string;
    slug: string;
    version?: string;
    owner?: string;
    scheme?: string | string[];
    runtimeVersion?: string | { policy: string };
    ios?: { bundleIdentifier?: string; buildNumber?: string; [key: string]: any };
    android?: { package?: string; versionCode?: number; [key: string]: any };
    extra?: { [key: string]: any };
    updates?: { url?: string; enabled?: boolean; [key: string]: any };
    [key: string]: any;
  }
  export interface Constants {
    appOwnership: 'expo' | null;
    debugMode: boolean;
    deviceName?: string;
    deviceYearClass: number | null;
    executionEnvironment: ExecutionEnvironment;
    experienceUrl: string;
    expoRuntimeVersion: string | null;
    expoVersion: string | null;
    isHeadless: boolean;
    linkingUri: string;
    sessionId: string;
    statusBarHeight: number;
    systemFonts: string[];
    systemVersion?: number;
    expoConfig: (ExpoConfig & { hostUri?: string }) | null;
    manifest2: any;
    easConfig: { projectId?: string } | null;
    platform?: { ios?: { buildNumber: string | null; model?: string | null; systemVersion?: string }; android?: { versionCode: number } };
    getWebViewUserAgentAsync(): Promise<string | null>;
  }
  const constants: Constants;
  export default constants;
}

declare module 'expo-font' {
  export type FontSource = string | number | { uri: string; display?: string } | any;
  export function useFonts(map: string | Record<string, FontSource>): [loaded: boolean, error: Error | null];
  export function loadAsync(fontFamilyOrFontMap: string | Record<string, FontSource>, source?: FontSource): Promise<void>;
  export function isLoaded(fontFamily: string): boolean;
}

declare module '@expo-google-fonts/manrope' {
  export const Manrope_200ExtraLight: number;
  export const Manrope_300Light: number;
  export const Manrope_400Regular: number;
  export const Manrope_500Medium: number;
  export const Manrope_600SemiBold: number;
  export const Manrope_700Bold: number;
  export const Manrope_800ExtraBold: number;
  export function useFonts(map: Record<string, any>): [boolean, Error | null];
}

declare module '@expo-google-fonts/unbounded' {
  export const Unbounded_200ExtraLight: number;
  export const Unbounded_300Light: number;
  export const Unbounded_400Regular: number;
  export const Unbounded_500Medium: number;
  export const Unbounded_600SemiBold: number;
  export const Unbounded_700Bold: number;
  export const Unbounded_800ExtraBold: number;
  export const Unbounded_900Black: number;
  export function useFonts(map: Record<string, any>): [boolean, Error | null];
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hideAsync(): Promise<void>;
  export function hide(): void;
  export function setOptions(options: { duration?: number; fade?: boolean }): void;
}

declare module 'expo-status-bar' {
  import type { ReactElement } from 'react';
  export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark';
  export type StatusBarProps = {
    style?: StatusBarStyle;
    animated?: boolean;
    hidden?: boolean;
    hideTransitionAnimation?: 'fade' | 'slide' | 'none';
    networkActivityIndicatorVisible?: boolean;
    backgroundColor?: string;
    translucent?: boolean;
  };
  export function StatusBar(props: StatusBarProps): ReactElement | null;
  export function setStatusBarStyle(style: StatusBarStyle, animated?: boolean): void;
  export function setStatusBarHidden(hidden: boolean, animation?: 'fade' | 'slide' | 'none'): void;
}

declare module 'expo-haptics' {
  export enum NotificationFeedbackType {
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
  }
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
    Soft = 'soft',
    Rigid = 'rigid',
  }
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-clipboard' {
  export function setStringAsync(text: string, options?: { inputFormat?: 'plainText' | 'html' }): Promise<boolean>;
  export function getStringAsync(options?: { preferredFormat?: 'plainText' | 'html' }): Promise<string>;
  export function hasStringAsync(): Promise<boolean>;
  export function setImageAsync(base64Image: string): Promise<void>;
}

declare module 'expo-crypto' {
  export function randomUUID(): string;
  export function getRandomBytes(byteCount: number): Uint8Array;
  export enum CryptoDigestAlgorithm {
    SHA1 = 'SHA-1',
    SHA256 = 'SHA-256',
    SHA384 = 'SHA-384',
    SHA512 = 'SHA-512',
    MD5 = 'MD5',
  }
  export enum CryptoEncoding {
    HEX = 'hex',
    BASE64 = 'base64',
  }
  export function digestStringAsync(algorithm: CryptoDigestAlgorithm, data: string, options?: { encoding: CryptoEncoding }): Promise<string>;
}

declare module 'expo-image-picker' {
  export type MediaType = 'images' | 'videos' | 'livePhotos';
  export enum MediaTypeOptions {
    All = 'All',
    Videos = 'Videos',
    Images = 'Images',
  }
  export enum UIImagePickerPreferredAssetRepresentationMode {
    Automatic = 'automatic',
    Compatible = 'compatible',
    Current = 'current',
  }
  export enum UIImagePickerPresentationStyle {
    FULL_SCREEN = 'fullScreen',
    PAGE_SHEET = 'pageSheet',
    FORM_SHEET = 'formSheet',
    AUTOMATIC = 'automatic',
  }
  export interface ImagePickerOptions {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    mediaTypes?: MediaType | MediaType[] | MediaTypeOptions;
    exif?: boolean;
    base64?: boolean;
    videoExportPreset?: number;
    videoQuality?: number;
    allowsMultipleSelection?: boolean;
    selectionLimit?: number;
    orderedSelection?: boolean;
    videoMaxDuration?: number;
    presentationStyle?: UIImagePickerPresentationStyle;
    preferredAssetRepresentationMode?: UIImagePickerPreferredAssetRepresentationMode;
    legacy?: boolean;
    shape?: 'rectangle' | 'oval';
    defaultTab?: 'photos' | 'albums';
    cameraType?: 'back' | 'front';
  }
  export interface ImagePickerAsset {
    uri: string;
    assetId?: string | null;
    width: number;
    height: number;
    type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo';
    fileName?: string | null;
    fileSize?: number;
    exif?: Record<string, any> | null;
    base64?: string | null;
    duration?: number | null;
    mimeType?: string;
    pairedVideoAsset?: ImagePickerAsset | null;
    file?: any;
  }
  export type ImagePickerSuccessResult = { canceled: false; assets: ImagePickerAsset[] };
  export type ImagePickerCanceledResult = { canceled: true; assets: null };
  export type ImagePickerResult = ImagePickerSuccessResult | ImagePickerCanceledResult;
  export enum PermissionStatus {
    DENIED = 'denied',
    GRANTED = 'granted',
    UNDETERMINED = 'undetermined',
  }
  export interface PermissionResponse {
    status: PermissionStatus;
    expires: 'never' | number;
    granted: boolean;
    canAskAgain: boolean;
  }
  export interface MediaLibraryPermissionResponse extends PermissionResponse {
    accessPrivileges?: 'all' | 'limited' | 'none';
  }
  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function requestMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<MediaLibraryPermissionResponse>;
  export function getMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<MediaLibraryPermissionResponse>;
  export function requestCameraPermissionsAsync(): Promise<PermissionResponse>;
  export function getPendingResultAsync(): Promise<Array<ImagePickerResult | { code: string; message: string }>>;
}

declare module 'expo-media-library' {
  export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
  export type GranularPermission = 'audio' | 'photo' | 'video';
  export interface PermissionResponse {
    status: PermissionStatus;
    expires: 'never' | number;
    granted: boolean;
    canAskAgain: boolean;
    accessPrivileges?: 'all' | 'limited' | 'none';
  }
  export type MediaTypeValue = 'audio' | 'photo' | 'video' | 'unknown' | 'pairedVideo';
  export interface Asset {
    id: string;
    filename: string;
    uri: string;
    mediaType: MediaTypeValue;
    mediaSubtypes?: string[];
    width: number;
    height: number;
    creationTime: number;
    modificationTime: number;
    duration: number;
    albumId?: string;
  }
  export interface Album {
    id: string;
    title: string;
    assetCount: number;
    type?: string;
  }
  export function requestPermissionsAsync(writeOnly?: boolean, granularPermissions?: GranularPermission[]): Promise<PermissionResponse>;
  export function getPermissionsAsync(writeOnly?: boolean, granularPermissions?: GranularPermission[]): Promise<PermissionResponse>;
  export function saveToLibraryAsync(localUri: string): Promise<void>;
  export function createAssetAsync(localUri: string, album?: Album | string): Promise<Asset>;
  export function getAlbumAsync(title: string): Promise<Album | null>;
  export function createAlbumAsync(albumName: string, asset?: Asset | string, copyAsset?: boolean, initialAssetLocalUri?: string): Promise<Album>;
  export function addAssetsToAlbumAsync(assets: Asset[] | Asset | string[] | string, album: Album | string, copy?: boolean): Promise<boolean>;
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-sharing' {
  export interface SharingOptions {
    mimeType?: string;
    UTI?: string;
    dialogTitle?: string;
    anchor?: { x: number; y: number; width: number; height: number };
  }
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: SharingOptions): Promise<void>;
}

declare module 'expo-mail-composer' {
  export enum MailComposerStatus {
    UNDETERMINED = 'undetermined',
    SENT = 'sent',
    SAVED = 'saved',
    CANCELLED = 'cancelled',
  }
  export interface MailComposerOptions {
    recipients?: string[];
    ccRecipients?: string[];
    bccRecipients?: string[];
    subject?: string;
    body?: string;
    isHtml?: boolean;
    attachments?: string[];
  }
  export interface MailComposerResult {
    status: MailComposerStatus;
  }
  export function composeAsync(options: MailComposerOptions): Promise<MailComposerResult>;
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-localization' {
  export interface Locale {
    languageTag: string;
    languageCode: string | null;
    languageScriptCode?: string | null;
    regionCode: string | null;
    languageRegionCode?: string | null;
    currencyCode: string | null;
    currencySymbol: string | null;
    languageCurrencyCode?: string | null;
    languageCurrencySymbol?: string | null;
    decimalSeparator: string | null;
    digitGroupingSeparator: string | null;
    textDirection: 'ltr' | 'rtl' | null;
    measurementSystem: 'metric' | 'us' | 'uk' | null;
    temperatureUnit: 'celsius' | 'fahrenheit' | null;
  }
  export enum Weekday {
    SUNDAY = 1,
    MONDAY = 2,
    TUESDAY = 3,
    WEDNESDAY = 4,
    THURSDAY = 5,
    FRIDAY = 6,
    SATURDAY = 7,
  }
  export interface Calendar {
    calendar: string | null;
    uses24hourClock: boolean | null;
    firstWeekday: Weekday | null;
    timeZone: string | null;
  }
  export function getLocales(): Locale[];
  export function getCalendars(): Calendar[];
  export function useLocales(): Locale[];
  export function useCalendars(): Calendar[];
}

declare module 'expo-file-system/legacy' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export const bundleDirectory: string | null;
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }
  export type FileInfo =
    | { exists: true; uri: string; size: number; isDirectory: boolean; modificationTime: number; md5?: string }
    | { exists: false; uri: string; isDirectory: false };
  export interface ReadingOptions {
    encoding?: EncodingType | 'utf8' | 'base64';
    position?: number;
    length?: number;
  }
  export interface WritingOptions {
    encoding?: EncodingType | 'utf8' | 'base64';
    append?: boolean;
  }
  export interface MakeDirectoryOptions {
    intermediates?: boolean;
  }
  export interface DeletingOptions {
    idempotent?: boolean;
  }
  export interface RelocatingOptions {
    from: string;
    to: string;
  }
  export interface InfoOptions {
    md5?: boolean;
    size?: boolean;
  }
  export function getInfoAsync(fileUri: string, options?: InfoOptions): Promise<FileInfo>;
  export function readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: WritingOptions): Promise<void>;
  export function deleteAsync(fileUri: string, options?: DeletingOptions): Promise<void>;
  export function moveAsync(options: RelocatingOptions): Promise<void>;
  export function copyAsync(options: RelocatingOptions): Promise<void>;
  export function makeDirectoryAsync(fileUri: string, options?: MakeDirectoryOptions): Promise<void>;
  export function readDirectoryAsync(fileUri: string): Promise<string[]>;
  export function downloadAsync(uri: string, fileUri: string, options?: { headers?: Record<string, string>; md5?: boolean }): Promise<{ uri: string; status: number; headers: Record<string, string>; md5?: string; mimeType: string | null }>;
}

declare module 'expo-updates' {
  export interface Manifest {
    id?: string;
    createdAt?: string;
    [key: string]: any;
  }
  export type UpdateCheckResult =
    | { isAvailable: true; manifest: Manifest; isRollBackToEmbedded: false; reason: undefined }
    | { isAvailable: false; manifest: undefined; isRollBackToEmbedded: boolean; reason: string };
  export type UpdateFetchResult =
    | { isNew: true; manifest: Manifest; isRollBackToEmbedded: false }
    | { isNew: false; manifest: undefined; isRollBackToEmbedded: boolean };
  export const isEnabled: boolean;
  export const isEmbeddedLaunch: boolean;
  export const isEmergencyLaunch: boolean;
  export const updateId: string | null;
  export const channel: string | null;
  export const runtimeVersion: string | null;
  export const createdAt: Date | null;
  export const manifest: Partial<Manifest>;
  export function checkForUpdateAsync(): Promise<UpdateCheckResult>;
  export function fetchUpdateAsync(): Promise<UpdateFetchResult>;
  export function reloadAsync(options?: { reloadScreenOptions?: object }): Promise<void>;
  export function useUpdates(): any;
}

declare module 'expo-video' {
  import type { ReactElement } from 'react';
  import type { ViewProps } from 'react-native';
  export type VideoSource = string | number | null | { uri?: string; assetId?: number; metadata?: { title?: string; artist?: string; artwork?: string }; headers?: Record<string, string>; useCaching?: boolean; contentType?: 'auto' | 'progressive' | 'hls' | 'dash' | 'smoothStreaming' };
  export type VideoPlayerStatus = 'idle' | 'loading' | 'readyToPlay' | 'error';
  export interface VideoPlayerEvents {
    playingChange: (payload: { isPlaying: boolean; oldIsPlaying?: boolean }) => void;
    statusChange: (payload: { status: VideoPlayerStatus; oldStatus?: VideoPlayerStatus; error?: { message: string } }) => void;
    timeUpdate: (payload: { currentTime: number; currentLiveTimestamp: number | null; currentOffsetFromLive: number | null; bufferedPosition: number }) => void;
    playToEnd: () => void;
    sourceChange: (payload: { source: VideoSource; oldSource?: VideoSource }) => void;
    [event: string]: (...args: any[]) => void;
  }
  export interface VideoPlayer {
    loop: boolean;
    muted: boolean;
    volume: number;
    playbackRate: number;
    preservesPitch: boolean;
    currentTime: number;
    readonly duration: number;
    readonly playing: boolean;
    readonly status: VideoPlayerStatus;
    timeUpdateEventInterval: number;
    allowsExternalPlayback: boolean;
    audioMixingMode: 'mixWithOthers' | 'duckOthers' | 'auto' | 'doNotMix';
    staysActiveInBackground: boolean;
    showNowPlayingNotification: boolean;
    play(): void;
    pause(): void;
    replace(source: VideoSource, disableWarning?: boolean): void;
    replaceAsync(source: VideoSource): Promise<void>;
    seekBy(seconds: number): void;
    replay(): void;
    release(): void;
    addListener<K extends keyof VideoPlayerEvents>(eventName: K, listener: VideoPlayerEvents[K]): { remove(): void };
    generateThumbnailsAsync(times: number | number[], options?: { maxWidth?: number; maxHeight?: number }): Promise<any[]>;
  }
  export function useVideoPlayer(source: VideoSource, setup?: (player: VideoPlayer) => void): VideoPlayer;
  export function createVideoPlayer(source: VideoSource): VideoPlayer;
  export interface VideoViewProps extends ViewProps {
    player: VideoPlayer;
    nativeControls?: boolean;
    contentFit?: 'contain' | 'cover' | 'fill';
    allowsFullscreen?: boolean;
    allowsPictureInPicture?: boolean;
    startsPictureInPictureAutomatically?: boolean;
    showsTimecodes?: boolean;
    requiresLinearPlayback?: boolean;
    surfaceType?: 'textureView' | 'surfaceView';
    allowsVideoFrameAnalysis?: boolean;
    contentPosition?: { dx?: number; dy?: number };
    onFirstFrameRender?: () => void;
    onFullscreenEnter?: () => void;
    onFullscreenExit?: () => void;
    crossOrigin?: 'anonymous' | 'use-credentials';
    useExoShutter?: boolean;
  }
  export function VideoView(props: VideoViewProps): ReactElement | null;
}

declare module 'expo-blur' {
  import type { ReactElement } from 'react';
  import type { ViewProps } from 'react-native';
  export type BlurTint =
    | 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent'
    | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial'
    | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight'
    | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark';
  export interface BlurViewProps extends ViewProps {
    tint?: BlurTint;
    intensity?: number;
    blurReductionFactor?: number;
    experimentalBlurMethod?: 'none' | 'dimezisBlurView';
  }
  export function BlurView(props: BlurViewProps): ReactElement | null;
}

declare module 'expo-image' {
  import type { ReactElement } from 'react';
  import type { ViewProps, StyleProp, ImageStyle, ViewStyle } from 'react-native';
  export type ImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  export type ImageSource = { uri?: string; headers?: Record<string, string>; width?: number | null; height?: number | null; blurhash?: string; thumbhash?: string; cacheKey?: string; isAnimated?: boolean };
  export interface ImageProps extends Omit<ViewProps, 'style'> {
    source?: ImageSource | string | number | ImageSource[] | string[] | null;
    placeholder?: ImageSource | string | number | ImageSource[] | string[] | null;
    contentFit?: ImageContentFit;
    placeholderContentFit?: ImageContentFit;
    contentPosition?: string | { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string };
    transition?: number | { duration?: number; timing?: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear'; effect?: string | null } | null;
    blurRadius?: number;
    tintColor?: string | null;
    priority?: 'low' | 'normal' | 'high' | null;
    cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk' | null;
    recyclingKey?: string | null;
    allowDownscaling?: boolean;
    autoplay?: boolean;
    style?: StyleProp<ImageStyle | ViewStyle>;
    responsivePolicy?: 'live' | 'initial' | 'static';
    enableLiveTextInteraction?: boolean;
    alt?: string;
    onLoad?: (event: { cacheType: string; source: { url: string; width: number; height: number; mediaType: string | null; isAnimated?: boolean } }) => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (event: { error: string }) => void;
    onProgress?: (event: { loaded: number; total: number }) => void;
    onDisplay?: () => void;
  }
  export function Image(props: ImageProps): ReactElement | null;
}

declare module 'expo-linking' {
  export function openURL(url: string): Promise<true>;
  export function openSettings(): Promise<void>;
  export function createURL(path: string, options?: { queryParams?: Record<string, string>; scheme?: string }): string;
  export function canOpenURL(url: string): Promise<boolean>;
}

declare module 'expo-web-browser' {
  export function openBrowserAsync(url: string, options?: Record<string, unknown>): Promise<{ type: string }>;
}

declare module '@react-native-async-storage/async-storage' {
  export interface AsyncStorageStatic {
    getItem(key: string, callback?: (error?: Error | null, result?: string | null) => void): Promise<string | null>;
    setItem(key: string, value: string, callback?: (error?: Error | null) => void): Promise<void>;
    removeItem(key: string, callback?: (error?: Error | null) => void): Promise<void>;
    mergeItem(key: string, value: string, callback?: (error?: Error | null) => void): Promise<void>;
    clear(callback?: (error?: Error | null) => void): Promise<void>;
    getAllKeys(callback?: (error?: Error | null, result?: readonly string[]) => void): Promise<readonly string[]>;
    multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
    multiSet(keyValuePairs: ReadonlyArray<readonly [string, string]>): Promise<void>;
    multiRemove(keys: readonly string[]): Promise<void>;
    multiMerge(keyValuePairs: [string, string][]): Promise<void>;
  }
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

declare module 'react-native-view-shot' {
  import type { Component, RefObject } from 'react';
  export interface CaptureOptions {
    width?: number;
    height?: number;
    format?: 'jpg' | 'png' | 'webm' | 'raw';
    quality?: number;
    result?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
    snapshotContentContainer?: boolean;
    fileName?: string;
    useRenderInContext?: boolean;
    handleGLSurfaceViewOnAndroid?: boolean;
  }
  export function captureRef<T>(viewRef: number | Component | RefObject<T>, options?: CaptureOptions): Promise<string>;
  export function captureScreen(options?: CaptureOptions): Promise<string>;
  export function releaseCapture(uri: string): void;
  export default class ViewShot extends Component<{ options?: CaptureOptions; captureMode?: 'mount' | 'continuous' | 'update'; children?: import('react').ReactNode; onCapture?: (uri: string) => void; onCaptureFailure?: (e: Error) => void; style?: any }> {
    capture?: () => Promise<string>;
  }
}

declare module 'react-native-safe-area-context' {
  import type { ReactElement, ReactNode } from 'react';
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
  export function useSafeAreaInsets(): EdgeInsets;
  export function useSafeAreaFrame(): Rect;
  export const initialWindowMetrics: Metrics | null;
  export interface SafeAreaProviderProps extends ViewProps {
    children?: ReactNode;
    initialMetrics?: Metrics | null;
    initialSafeAreaInsets?: EdgeInsets | null;
  }
  export function SafeAreaProvider(props: SafeAreaProviderProps): ReactElement;
  export interface SafeAreaViewProps extends ViewProps {
    mode?: 'padding' | 'margin';
    edges?: readonly Edge[] | Readonly<Partial<Record<Edge, EdgeMode>>>;
  }
  export function SafeAreaView(props: SafeAreaViewProps): ReactElement;
}
