// T48: friendly message when a photo can't be opened or processed, instead of a red render error.
// - ImageErrorMessage: the card (what happened + what to try), used directly for async errors.
// - ImageErrorBoundary: React error boundary that shows the same card when its children throw while rendering.
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space } from '../theme/tokens';
import { useTypography } from '../theme/typography';
import { useT } from '../i18n';
import { backArrow } from '../i18n/direction';
import type { MessageKey } from '../i18n/en/index';
import { canRetry, classifyImageError, type ImageErrorKind } from '../core/imageErrors';
import { Button } from './Button';

const TITLE: Record<ImageErrorKind, MessageKey> = {
  unsupported: 'common.imageError.unsupported.title',
  tooLarge: 'common.imageError.tooLarge.title',
  heic: 'common.imageError.heic.title',
  memory: 'common.imageError.memory.title',
  unknown: 'common.imageError.unknown.title',
};

const BODY: Record<ImageErrorKind, MessageKey> = {
  unsupported: 'common.imageError.unsupported.body',
  tooLarge: 'common.imageError.tooLarge.body',
  heic: 'common.imageError.heic.body',
  memory: 'common.imageError.memory.body',
  unknown: 'common.imageError.unknown.body',
};

/** Translation keys for a kind (e.g. for an Alert on Home). */
export function imageErrorKeys(kind: ImageErrorKind): { title: MessageKey; body: MessageKey } {
  return { title: TITLE[kind], body: BODY[kind] };
}

export type ImageErrorActions = {
  /** "Try again" (shown only for kinds where retrying the same photo can help). */
  onRetry?: () => void;
  /** "Try another photo": re-open the picker (or go Home). */
  onTryAnother?: () => void;
  /** "Go back". */
  onGoBack?: () => void;
};

export type ImageErrorMessageProps = ImageErrorActions & {
  kind: ImageErrorKind;
  style?: StyleProp<ViewStyle>;
};

export function ImageErrorMessage({ kind, onRetry, onTryAnother, onGoBack, style }: ImageErrorMessageProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const { t } = useT();
  const retry = onRetry && canRetry(kind) ? onRetry : undefined;
  const title = t(TITLE[kind]);
  const body = t(BODY[kind]);
  // Night 23 Oct (cross-app, from Couch/Glaze "never silent"): live regions and role="alert" are not spoken on
  // iOS, so VoiceOver users heard nothing when a photo couldn't be opened. Say it once per error kind.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try {
      AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
    } catch {
      // Screen reader API unavailable: the card is still on screen.
    }
  }, [kind, title, body]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        {
          padding: space.lg,
          borderRadius: radius.md,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.warn,
        },
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={{ ...ty.face('display'), fontSize: 19, lineHeight: ty.lhOf(25), color: c.graphite }}
      >
        {title}
      </Text>
      <Text
        accessibilityRole="alert"
        style={{ ...ty.face('body'), fontSize: 15, lineHeight: ty.lhOf(21), color: c.graphite, marginTop: space.xs }}
      >
        {body}
      </Text>
      {retry ? (
        <Button title={t('common.tryAgain')} variant="secondary" icon="refresh-cw" onPress={retry} style={{ marginTop: space.md }} />
      ) : null}
      {onTryAnother ? (
        <Button
          title={t('common.imageError.tryAnother')}
          variant="secondary"
          icon="image"
          onPress={onTryAnother}
          accessibilityHint={t('common.imageError.tryAnotherHint')}
          style={{ marginTop: space.md }}
        />
      ) : null}
      {onGoBack ? (
        <Button
          title={t('common.imageError.goBack')}
          variant="secondary"
          icon={backArrow()}
          onPress={onGoBack}
          style={{ marginTop: space.md }}
        />
      ) : null}
    </View>
  );
}

export type ImageErrorBoundaryProps = ImageErrorActions & {
  children: ReactNode;
  /** When this changes (e.g. a new photo uri), a caught error is cleared and the children render again. */
  resetKey?: string;
  /** Style of the fallback card. */
  style?: StyleProp<ViewStyle>;
  /** Fill the screen (paper background, padded) instead of sitting inline. */
  fullScreen?: boolean;
};

type BoundaryState = { kind: ImageErrorKind | null };

function FullScreen({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.paper, padding: space.xl, justifyContent: 'center' }}>{children}</View>;
}

export class ImageErrorBoundary extends Component<ImageErrorBoundaryProps, BoundaryState> {
  state: BoundaryState = { kind: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { kind: classifyImageError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (__DEV__) console.warn('ImageErrorBoundary caught', error, info.componentStack); // i18n-ignore
  }

  componentDidUpdate(prev: ImageErrorBoundaryProps) {
    if (this.state.kind !== null && prev.resetKey !== this.props.resetKey) this.setState({ kind: null });
  }

  private reset = () => {
    this.setState({ kind: null });
    if (this.props.onRetry) this.props.onRetry();
  };

  render() {
    const { kind } = this.state;
    if (kind === null) return this.props.children;
    const card = (
      <ImageErrorMessage
        kind={kind}
        onRetry={this.reset}
        onTryAnother={this.props.onTryAnother}
        onGoBack={this.props.onGoBack}
        style={this.props.style}
      />
    );
    return this.props.fullScreen ? <FullScreen>{card}</FullScreen> : card;
  }
}
