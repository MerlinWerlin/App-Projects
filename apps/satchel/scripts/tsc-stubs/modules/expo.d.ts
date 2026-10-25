// Offline stubs for the Expo SDK 57 modules the app imports (public API shapes from each package's build/*.d.ts).
// Only members the app uses are declared; see ../README.md.

declare module 'expo-router' {
  import type { ComponentType, ReactNode } from 'react';
  import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

  // typedRoutes is off in app.json, so Href is the untyped form.
  export type UnknownInputParams = Record<string, string | number | undefined | null | (string | number)[]>;
  export type HrefObject = { pathname: string; params?: UnknownInputParams };
  export type Href = string | HrefObject;
  export type NavigationOptions = { relativeToDirectory?: boolean; withAnchor?: boolean; dangerouslySingular?: boolean };

  export type Router = {
    back: () => void;
    canGoBack: () => boolean;
    push: (href: Href, options?: NavigationOptions) => void;
    navigate: (href: Href, options?: NavigationOptions) => void;
    replace: (href: Href, options?: NavigationOptions) => void;
    dismiss: (count?: number) => void;
    dismissAll: () => void;
    dismissTo: (href: Href, options?: NavigationOptions) => void;
    canDismiss: () => boolean;
    setParams: (params: Partial<UnknownInputParams>) => void;
  };
  export const router: Router;
  export function useRouter(): Router;

  export type UnknownOutputParams = Record<string, string | string[]>;
  export function useLocalSearchParams<TParams extends Record<string, string | string[] | undefined> = UnknownOutputParams>(): TParams;
  export function useGlobalSearchParams<TParams extends Record<string, string | string[] | undefined> = UnknownOutputParams>(): TParams;
  export function useFocusEffect(effect: () => undefined | void | (() => void), do_not_pass_a_second_prop?: never): void;
  export function usePathname(): string;
  export function useSegments(): string[];

  export type ErrorBoundaryProps = { error: Error; retry: () => Promise<void> };

  export type StackAnimationTypes =
    | 'default' | 'fade' | 'fade_from_bottom' | 'flip' | 'simple_push' | 'slide_from_bottom'
    | 'slide_from_right' | 'slide_from_left' | 'ios_from_right' | 'ios_from_left' | 'none';
  export type NativeStackNavigationOptions = {
    title?: string;
    headerShown?: boolean;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
    headerTitleAlign?: 'left' | 'center';
    headerStyle?: { backgroundColor?: string };
    headerTintColor?: string;
    headerTitleStyle?: StyleProp<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight'> & { color?: string }>;
    headerLargeTitle?: boolean;
    headerShadowVisible?: boolean;
    headerTransparent?: boolean;
    headerBackTitle?: string;
    headerBackVisible?: boolean;
    headerBackButtonDisplayMode?: 'default' | 'generic' | 'minimal';
    headerLeft?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    animation?: StackAnimationTypes;
    animationDuration?: number;
    animationTypeForReplace?: 'push' | 'pop';
    gestureEnabled?: boolean;
    fullScreenGestureEnabled?: boolean;
    presentation?: 'card' | 'modal' | 'transparentModal' | 'containedModal' | 'containedTransparentModal' | 'fullScreenModal' | 'formSheet';
    orientation?: 'default' | 'all' | 'portrait' | 'portrait_up' | 'portrait_down' | 'landscape' | 'landscape_left' | 'landscape_right';
    statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
    statusBarHidden?: boolean;
    navigationBarHidden?: boolean;
    freezeOnBlur?: boolean;
  };
  export type ScreenProps = {
    name?: string;
    options?: NativeStackNavigationOptions | ((props: { route: unknown; navigation: unknown }) => NativeStackNavigationOptions);
    initialParams?: Record<string, unknown>;
    redirect?: boolean;
    children?: ReactNode;
  };
  type StackProps = {
    screenOptions?: NativeStackNavigationOptions | ((props: { route: unknown; navigation: unknown }) => NativeStackNavigationOptions);
    initialRouteName?: string;
    children?: ReactNode;
  };
  export const Stack: ComponentType<StackProps> & { Screen: ComponentType<ScreenProps> };
  // Tabs (bottom-tabs navigator via expo-router, SDK 57 / React Navigation 7): only the members the app uses.
  export type BottomTabNavigationOptions = {
    title?: string;
    headerShown?: boolean;
    headerTitle?: string;
    headerStyle?: { backgroundColor?: string };
    headerTintColor?: string;
    headerTitleStyle?: { fontFamily?: string; fontWeight?: TextStyle['fontWeight']; fontSize?: number; color?: string };
    headerShadowVisible?: boolean;
    sceneStyle?: StyleProp<ViewStyle>;
    tabBarLabel?: string;
    tabBarAccessibilityLabel?: string;
    tabBarHideOnKeyboard?: boolean;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    tabBarStyle?: StyleProp<ViewStyle>;
    tabBarLabelStyle?: StyleProp<TextStyle>;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
    tabBarBadge?: string | number;
    lazy?: boolean;
    freezeOnBlur?: boolean;
    href?: Href | null;
  };
  export type BottomTabBarProps = {
    state: { index: number; key: string; routes: { key: string; name: string; params?: object }[] };
    descriptors: Record<string, { options: BottomTabNavigationOptions }>;
    navigation: {
      emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
      navigate: (name: string, params?: object) => void;
    };
    insets: { top: number; right: number; bottom: number; left: number };
  };
  type TabsScreenProps = {
    name?: string;
    options?: BottomTabNavigationOptions | ((props: { route: unknown; navigation: unknown }) => BottomTabNavigationOptions);
    initialParams?: Record<string, unknown>;
    redirect?: boolean;
  };
  type TabsProps = {
    screenOptions?: BottomTabNavigationOptions | ((props: { route: unknown; navigation: unknown }) => BottomTabNavigationOptions);
    tabBar?: (props: BottomTabBarProps) => ReactNode;
    backBehavior?: 'firstRoute' | 'initialRoute' | 'order' | 'history' | 'fullHistory' | 'none';
    initialRouteName?: string;
    children?: ReactNode;
  };
  export const Tabs: ComponentType<TabsProps> & { Screen: ComponentType<TabsScreenProps> };
  export const Slot: ComponentType<{}>;
  export const Link: ComponentType<{ href: Href; asChild?: boolean; replace?: boolean; push?: boolean; children?: ReactNode; style?: StyleProp<TextStyle> }>;
}

declare module 'expo-status-bar' {
  import type { ComponentType } from 'react';
  export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark';
  export type StatusBarAnimation = 'none' | 'fade' | 'slide';
  export type StatusBarProps = {
    style?: StatusBarStyle;
    animated?: boolean;
    hidden?: boolean;
    hideTransitionAnimation?: StatusBarAnimation;
    networkActivityIndicatorVisible?: boolean;
    backgroundColor?: string;
    translucent?: boolean;
  };
  export const StatusBar: ComponentType<StatusBarProps>;
  export function setStatusBarStyle(style: StatusBarStyle, animated?: boolean): void;
  export function setStatusBarHidden(hidden: boolean, animation?: StatusBarAnimation): void;
}

declare module 'expo-splash-screen' {
  export function preventAutoHideAsync(): Promise<boolean>;
  export function hideAsync(): Promise<void>;
  export function hide(): void;
  export function setOptions(options: { duration?: number; fade?: boolean }): void;
}

declare module 'expo-constants' {
  export type ExpoConfig = {
    name: string;
    slug: string;
    version?: string;
    runtimeVersion?: string | { policy: string };
    extra?: { [k: string]: any };
    ios?: { buildNumber?: string; bundleIdentifier?: string; [k: string]: any };
    android?: { versionCode?: number; package?: string; [k: string]: any };
    [k: string]: any;
  };
  export enum ExecutionEnvironment {
    Bare = 'bare',
    Standalone = 'standalone',
    StoreClient = 'storeClient',
  }
  export interface Constants {
    expoConfig: ExpoConfig | null;
    executionEnvironment: ExecutionEnvironment;
    appOwnership: 'expo' | null;
    deviceName?: string;
    sessionId: string;
    statusBarHeight: number;
    systemFonts: string[];
    [k: string]: any;
  }
  const Constants: Constants;
  export default Constants;
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
  export type InfoOptions = { md5?: boolean; size?: boolean };
  export type ReadingOptions = { encoding?: EncodingType | 'utf8' | 'base64'; position?: number; length?: number };
  export type WritingOptions = { encoding?: EncodingType | 'utf8' | 'base64'; append?: boolean };
  export type DeletingOptions = { idempotent?: boolean };
  export type MakeDirectoryOptions = { intermediates?: boolean };
  export type RelocatingOptions = { from: string; to: string };
  export function getInfoAsync(fileUri: string, options?: InfoOptions): Promise<FileInfo>;
  export function readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: WritingOptions): Promise<void>;
  export function deleteAsync(fileUri: string, options?: DeletingOptions): Promise<void>;
  export function moveAsync(options: RelocatingOptions): Promise<void>;
  export function copyAsync(options: RelocatingOptions): Promise<void>;
  export function makeDirectoryAsync(fileUri: string, options?: MakeDirectoryOptions): Promise<void>;
  export function readDirectoryAsync(fileUri: string): Promise<string[]>;
  export function getFreeDiskStorageAsync(): Promise<number>;
  export function downloadAsync(uri: string, fileUri: string, options?: { headers?: Record<string, string>; md5?: boolean }): Promise<{ uri: string; status: number; headers: Record<string, string>; mimeType: string | null }>;
}

declare module 'expo-camera' {
  import type { Component } from 'react';
  import type { ViewProps } from 'react-native';
  export type CameraType = 'front' | 'back';
  export type FlashMode = 'off' | 'on' | 'auto';
  export type FocusMode = 'on' | 'off';
  export type CameraMode = 'picture' | 'video';
  export type VideoQuality = '2160p' | '1080p' | '720p' | '480p' | '4:3';
  export type CameraRecordingOptions = {
    maxDuration?: number;
    maxFileSize?: number;
    mirror?: boolean;
    codec?: string;
  };
  export type CameraPictureOptions = { quality?: number; base64?: boolean; exif?: boolean; skipProcessing?: boolean; shutterSound?: boolean };
  export type CameraCapturedPicture = { width: number; height: number; uri: string; base64?: string; exif?: Record<string, any> };
  export type CameraMountError = { message: string };
  export interface CameraViewProps extends ViewProps {
    facing?: CameraType;
    flash?: FlashMode;
    zoom?: number;
    mode?: CameraMode;
    mute?: boolean;
    mirror?: boolean;
    enableTorch?: boolean;
    autofocus?: FocusMode;
    videoQuality?: VideoQuality;
    videoStabilizationMode?: 'off' | 'standard' | 'cinematic' | 'auto';
    active?: boolean;
    animateShutter?: boolean;
    responsiveOrientationWhenOrientationLocked?: boolean;
    onCameraReady?: () => void;
    onMountError?: (event: CameraMountError) => void;
    barcodeScannerSettings?: { barcodeTypes: string[] };
    onBarcodeScanned?: (result: { type: string; data: string }) => void;
  }
  export class CameraView extends Component<CameraViewProps> {
    takePictureAsync(options?: CameraPictureOptions): Promise<CameraCapturedPicture | undefined>;
    recordAsync(options?: CameraRecordingOptions): Promise<{ uri: string } | undefined>;
    stopRecording(): void;
    toggleRecordingAsync(): Promise<void>;
    pausePreview(): Promise<void>;
    resumePreview(): Promise<void>;
  }
  export enum PermissionStatus {
    DENIED = 'denied',
    GRANTED = 'granted',
    UNDETERMINED = 'undetermined',
  }
  export type PermissionExpiration = 'never' | number;
  export interface PermissionResponse {
    status: PermissionStatus;
    expires: PermissionExpiration;
    granted: boolean;
    canAskAgain: boolean;
  }
  export type PermissionHookReturn = [PermissionResponse | null, () => Promise<PermissionResponse>, () => Promise<PermissionResponse>];
  export function useCameraPermissions(options?: { get?: boolean; request?: boolean }): PermissionHookReturn;
  export function useMicrophonePermissions(options?: { get?: boolean; request?: boolean }): PermissionHookReturn;
}

declare module 'expo-keep-awake' {
  export const ExpoKeepAwakeTag: string;
  export function useKeepAwake(tag?: string, options?: { suppressDeactivateWarnings?: boolean; listener?: (event: unknown) => void }): void;
  export function activateKeepAwake(tag?: string): Promise<void>;
  export function activateKeepAwakeAsync(tag?: string): Promise<void>;
  export function deactivateKeepAwake(tag?: string): Promise<void>;
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-image-picker' {
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
  export type CameraPermissionResponse = PermissionResponse;
  export type MediaLibraryPermissionResponse = PermissionResponse & { accessPrivileges?: 'all' | 'limited' | 'none' };
  export type MediaType = 'images' | 'videos' | 'livePhotos';
  export type ImagePickerAsset = {
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
  };
  export type ImagePickerSuccessResult = { canceled: false; assets: ImagePickerAsset[] };
  export type ImagePickerCanceledResult = { canceled: true; assets: null };
  export type ImagePickerResult = ImagePickerSuccessResult | ImagePickerCanceledResult;
  export type ImagePickerOptions = {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    mediaTypes?: MediaType | MediaType[];
    exif?: boolean;
    base64?: boolean;
    allowsMultipleSelection?: boolean;
    selectionLimit?: number;
    orderedSelection?: boolean;
    cameraType?: 'back' | 'front';
    legacy?: boolean;
    shape?: 'rectangle' | 'oval';
  };
  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function requestCameraPermissionsAsync(): Promise<CameraPermissionResponse>;
  export function getCameraPermissionsAsync(): Promise<CameraPermissionResponse>;
  export function requestMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<MediaLibraryPermissionResponse>;
  export function getMediaLibraryPermissionsAsync(writeOnly?: boolean): Promise<MediaLibraryPermissionResponse>;
}

declare module 'expo-image-manipulator' {
  export enum SaveFormat {
    JPEG = 'jpeg',
    PNG = 'png',
    WEBP = 'webp',
  }
  export type ActionResize = { resize: { width?: number; height?: number } };
  export type ActionRotate = { rotate: number };
  export enum FlipType {
    Vertical = 'vertical',
    Horizontal = 'horizontal',
  }
  export type ActionFlip = { flip: FlipType | 'vertical' | 'horizontal' };
  export type ActionCrop = { crop: { originX: number; originY: number; width: number; height: number } };
  export type ActionExtent = { extent: { backgroundColor?: string | null; originX?: number; originY?: number; width: number; height: number } };
  export type Action = ActionResize | ActionRotate | ActionFlip | ActionCrop | ActionExtent;
  export type SaveOptions = { base64?: boolean; compress?: number; format?: SaveFormat };
  export type ImageResult = { uri: string; width: number; height: number; base64?: string };
  /** @deprecated in SDK 52+ (use ImageManipulator.manipulate) but still exported. */
  export function manipulateAsync(uri: string, actions?: Action[], saveOptions?: SaveOptions): Promise<ImageResult>;
}

declare module 'expo-media-library' {
  export enum PermissionStatus {
    DENIED = 'denied',
    GRANTED = 'granted',
    UNDETERMINED = 'undetermined',
  }
  export type GranularPermission = 'audio' | 'photo' | 'video';
  export interface PermissionResponse {
    status: PermissionStatus;
    expires: 'never' | number;
    granted: boolean;
    canAskAgain: boolean;
    accessPrivileges?: 'all' | 'limited' | 'none';
  }
  export function getPermissionsAsync(writeOnly?: boolean, granularPermissions?: GranularPermission[]): Promise<PermissionResponse>;
  export function requestPermissionsAsync(writeOnly?: boolean, granularPermissions?: GranularPermission[]): Promise<PermissionResponse>;
  export function saveToLibraryAsync(localUri: string): Promise<void>;
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
    Soft = 'soft',
    Rigid = 'rigid',
  }
  export enum NotificationFeedbackType {
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
  }
  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-blur' {
  import type { Component } from 'react';
  import type { ViewProps } from 'react-native';
  export type BlurTint = 'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | (string & {});
  export type BlurViewProps = ViewProps & { tint?: BlurTint; intensity?: number; experimentalBlurMethod?: 'none' | 'dimezisBlurView' };
  export class BlurView extends Component<BlurViewProps> {}
}

declare module 'expo-localization' {
  export type Locale = { languageTag: string; languageCode: string | null; regionCode: string | null; textDirection: 'ltr' | 'rtl' | null };
  export function getLocales(): Locale[];
}
