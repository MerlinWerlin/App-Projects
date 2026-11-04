// T28 inline PDF viewer: shows a saved PDF ticket inside Satchel, full screen, with the system's own pinch-zoom
// and page scrolling (iOS WKWebView draws local PDFs natively from a file:// URI, offline).
// react-native-webview is a native module that only exists in TestFlight builds made after T28. It is required
// lazily inside try/catch, only after its native half is found, and rendered behind an error boundary, so an older
// build (an over-the-air update onto a binary without it), Android (its WebView can't draw PDFs) or a viewer that
// fails reports "not available" and the ticket view keeps the system share / preview sheet instead of crashing.
// The viewer only ever loads the one local file: JavaScript is off and every other navigation (a link inside the
// PDF) is refused, so nothing is fetched and nothing leaves the phone.
import { Component, type ReactNode } from 'react';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import type { ShouldStartLoadRequest } from 'react-native-webview';

type WebViewModule = typeof import('react-native-webview');

let cached: WebViewModule['WebView'] | null | undefined;
let failed = false;

function nativeHalfPresent(): boolean {
  try {
    if (TurboModuleRegistry.get('RNCWebViewModule')) return true;
  } catch {
    // fall through to the legacy check
  }
  try {
    return !!NativeModules.RNCWebViewModule || !!NativeModules.RNCWebView;
  } catch {
    return false;
  }
}

function load(): WebViewModule['WebView'] | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== 'ios') return cached;
  try {
    if (!nativeHalfPresent()) return cached;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as WebViewModule & { default?: unknown };
    const C = mod?.WebView ?? mod?.default;
    cached = typeof C === 'function' || (typeof C === 'object' && C !== null) ? (C as WebViewModule['WebView']) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when this build can show a PDF inside Satchel (and the viewer has not failed this session). */
export const pdfViewerAvailable = (): boolean => !failed && load() !== null;

/** The folder holding `uri` (with a trailing '/'), which is all the viewer may read. */
export function readableFolder(uri: string): string {
  const i = uri.lastIndexOf('/');
  return i >= 0 ? uri.slice(0, i + 1) : uri;
}

/**
 * Only local files (read access is limited to the PDF's own folder by allowingReadAccessToURL) and the blank start
 * page may load: a web link inside the PDF is refused, never opened. Any file: URL is allowed rather than an exact
 * match because WebKit may report the same file under another spelling (/private/var vs /var, escaping).
 */
export const allowLoad = (url: string): boolean => url.startsWith('file:') || url === 'about:blank';

class Boundary extends Component<{ children: ReactNode; onFail: () => void }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    failed = true;
    this.props.onFail();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

/** The PDF filling its parent, or nothing (and `onFail`) when the viewer is missing or breaks. */
export function PdfView({ uri, label, background, onFail }: { uri: string; label: string; background: string; onFail: () => void }) {
  const WebView = load();
  if (!WebView || failed) return null;
  const guard = (req: ShouldStartLoadRequest) => {
    try {
      return allowLoad(req.url);
    } catch {
      return false;
    }
  };
  return (
    <Boundary onFail={onFail}>
      <WebView
        source={{ uri }}
        // '*' so every load goes through `guard` (a URL outside the list would be handed to Safari instead).
        originWhitelist={['*']}
        allowFileAccess
        allowingReadAccessToURL={readableFolder(uri)}
        javaScriptEnabled={false}
        dataDetectorTypes="none"
        allowsLinkPreview={false}
        cacheEnabled={false}
        contentInsetAdjustmentBehavior="never"
        onShouldStartLoadWithRequest={guard}
        onError={onFail}
        onContentProcessDidTerminate={onFail}
        accessibilityLabel={label}
        style={{ flex: 1, backgroundColor: background }}
        containerStyle={{ flex: 1, backgroundColor: background }}
      />
    </Boundary>
  );
}
