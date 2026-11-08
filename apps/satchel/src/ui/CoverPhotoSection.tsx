// T152 trip edit: the trip's own cover photo. Choose (system picker, cropped to 16:9), Change or Remove; the change
// is stored on this phone straight away (src/state/coverPhotos.ts), apart from the trip's Save, and never goes into a
// trip file. A refused Photos permission shows the shared PermissionNotice (Try again / Open Settings, plus keeping
// the illustrated cover); other failures say what happened in plain words.
import { useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import type { CoverId } from '../core/covers.ts';
import type { PermissionState } from '../core/permissions.ts';
import type { Key } from '../i18n/en.ts';
import { pickCoverPhoto } from '../native/coverPhoto.ts';
import { useApp } from '../state/app.tsx';
import { clearCoverPhoto, setCoverPhoto, useCoverPhoto } from '../state/coverPhotos.ts';
import { space, typeScale } from '../theme/tokens.ts';
import { Button, Warning } from './kit.tsx';
import { PermissionNotice } from './PermissionNotice.tsx';
import { TripCover } from './TripCover.tsx';

type Problem = { kind: 'denied'; state: Exclude<PermissionState, 'granted'> } | { kind: 'unreadable' | 'storage' | 'save' } | null;

export function CoverPhotoSection({ tripId, tripName, scene }: { tripId: string | null; tripName: string; scene: CoverId }) {
  const { theme, t } = useApp();
  const photo = useCoverPhoto(tripId ?? undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  const choose = async () => {
    if (!tripId || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await pickCoverPhoto(tripId);
    if (r.ok) {
      const saved = await setCoverPhoto(tripId, r.uri);
      if (saved) AccessibilityInfo.announceForAccessibility(t('cover2.photo.added'));
      else setProblem({ kind: 'save' });
    } else if (r.reason === 'denied') {
      const state = r.permission && r.permission !== 'granted' ? r.permission : 'blocked';
      setProblem({ kind: 'denied', state });
    } else if (r.reason !== 'canceled') {
      setProblem({ kind: r.reason });
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!tripId || busy) return;
    setBusy(true);
    setProblem(null);
    if (await clearCoverPhoto(tripId)) AccessibilityInfo.announceForAccessibility(t('cover2.photo.removed'));
    else setProblem({ kind: 'save' });
    setBusy(false);
  };

  return (
    <View style={{ gap: space.s }}>
      <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
        {t('cover2.photo.title')}
      </Text>
      {tripId ? (
        <>
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('cover2.photo.body')}</Text>
          {photo ? (
            <>
              <TripCover scene={scene} photo={photo} aspectRatio={16 / 9} label={t('cover2.photo.preview', { name: tripName })} />
              <Button kind="secondary" icon="images-outline" label={t('cover2.photo.change')} hint={t('cover2.photo.changeHint')} onPress={choose} />
              <Button kind="quiet" label={t('cover2.photo.remove')} hint={t('cover2.photo.removeHint')} onPress={remove} />
              <Text style={[typeScale.small, { color: theme.muted }]}>{t('cover2.photo.withIllustration')}</Text>
            </>
          ) : (
            <Button kind="secondary" icon="images-outline" label={t('cover2.photo.choose')} hint={t('cover2.photo.chooseHint')} onPress={choose} />
          )}
          {problem?.kind === 'denied' ? (
            <PermissionNotice
              kind="photos"
              state={problem.state}
              reason={problem.state === 'blocked' ? t('cover2.photo.deniedReason') : undefined}
              onRetry={problem.state === 'ask' ? choose : undefined}
              fallbackLabel={t('cover2.photo.keepIllustration')}
              onFallback={() => setProblem(null)}
            />
          ) : problem ? (
            <Warning text={t(`cover2.photo.err.${problem.kind}` as Key)} />
          ) : null}
        </>
      ) : (
        <Text style={[typeScale.small, { color: theme.muted }]}>{t('cover2.photo.newTrip')}</Text>
      )}
    </View>
  );
}
