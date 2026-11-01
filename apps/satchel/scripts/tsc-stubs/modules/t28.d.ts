// Stubs added by T28 (inline PDF viewer). Hand-written from the published API of react-native-webview 13.16
// (lib/WebViewTypes.d.ts): only the props Satchel passes.
declare module 'react-native-webview' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';
  export type WebViewNavigation = { url: string; navigationType?: string; title?: string; loading?: boolean };
  export type ShouldStartLoadRequest = WebViewNavigation & { isTopFrame?: boolean; mainDocumentURL?: string };
  export type WebViewErrorEvent = { nativeEvent: { code?: number; description?: string; url?: string } };
  export type WebViewProps = {
    source: { uri: string } | { html: string; baseUrl?: string };
    originWhitelist?: string[];
    allowFileAccess?: boolean;
    allowFileAccessFromFileURLs?: boolean;
    allowingReadAccessToURL?: string;
    javaScriptEnabled?: boolean;
    scalesPageToFit?: boolean;
    bounces?: boolean;
    showsVerticalScrollIndicator?: boolean;
    contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
    automaticallyAdjustContentInsets?: boolean;
    dataDetectorTypes?: string | string[];
    allowsLinkPreview?: boolean;
    setSupportMultipleWindows?: boolean;
    cacheEnabled?: boolean;
    incognito?: boolean;
    onShouldStartLoadWithRequest?: (req: ShouldStartLoadRequest) => boolean;
    onLoadEnd?: () => void;
    onError?: (e: WebViewErrorEvent) => void;
    onContentProcessDidTerminate?: () => void;
    style?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    testID?: string;
  };
  export const WebView: ComponentType<WebViewProps>;
  export default WebView;
}
