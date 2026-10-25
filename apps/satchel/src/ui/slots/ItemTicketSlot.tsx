// Slot on the booking detail screen, owned by T04: attachments + Open ticket on the booking detail.
// Add from Files / Photos (copied into Satchel), open a file or the ticket view, save a QR crop, remove with confirm.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { Attachment, Item, Trip } from '../../core/model.ts';
import type { PermissionState } from '../../core/permissions.ts';
import { newId } from '../../core/model.ts';
import { addAttachment, attachmentKind, filesOf, makeAttachment, primaryTicket, removeAttachment, setQrCrop } from '../../core/tickets.ts';
import type { Key } from '../../i18n/en.ts';
import { haptic } from '../../native/device.ts';
import { removeFile } from '../../native/files.ts';
import { importAttachment, importQrCrop, type PickFailure } from '../../native/pickers.ts';
import { useApp } from '../../state/app.tsx';
import { useTrips } from '../../state/trips.tsx';
import { fonts, radius, space, TOUCH } from '../../theme/tokens.ts';
import { Body, Button, Card, Label, PressableScale, Warning } from '../kit.tsx';
import { PermissionNotice } from '../PermissionNotice.tsx';

/** A plain error, or Photos access refused (shown with PermissionNotice and the Files fallback). */
type Problem = { key: Key } | { photos: Exclude<PermissionState, 'granted'> } | null;

const failureKey = (reason: PickFailure, qr: boolean, permission?: PermissionState): Problem => {
  switch (reason) {
    case 'canceled':
      return null;
    case 'denied':
      return { photos: permission && permission !== 'granted' ? permission : 'blocked' };
    case 'unsupported':
      return { key: qr ? 'ticket.err.qr' : 'ticket.err.unsupported' };
    case 'storage':
      return { key: 'ticket.err.save' };
    default:
      return { key: qr ? 'ticket.err.qr' : 'ticket.err.add' };
  }
};

export function ItemTicketSlot({ item }: { trip: Trip; item: Item }) {
  const { t, theme } = useApp();
  const { saveItem } = useTrips();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [note, setNote] = useState<Key | null>(null);
  // Pickers are slow and the item may change meanwhile; always build on the latest version.
  const latest = useRef(item);
  latest.current = item;

  const primary = primaryTicket(item);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const add = (source: 'files' | 'photos') =>
    run(async () => {
      const r = await importAttachment(source, latest.current.kind);
      if (!r.ok) return setProblem(failureKey(r.reason, false, r.permission));
      if (!(await saveItem(addAttachment(latest.current, r.attachment)))) {
        // The booking couldn't be saved: drop the copy so no orphan file is left (STATES_COPY error.attachment.save).
        filesOf(r.attachment).forEach((u) => removeFile(u));
        return setProblem({ key: 'ticket.err.save' });
      }
      haptic.success();
    });

  const saveCrop = () =>
    run(async () => {
      const target = primaryTicket(latest.current) ?? latest.current.attachments[0];
      const r = await importQrCrop(target?.id ?? latest.current.id);
      if (!r.ok) return setProblem(failureKey(r.reason, true, r.permission));
      const cur = latest.current;
      const still = target ? cur.attachments.find((a) => a.id === target.id) : undefined;
      if (still) {
        const old = still.qrCropUri && still.qrCropUri !== still.uri ? still.qrCropUri : null;
        if (!(await saveItem(setQrCrop(cur, still.id, r.uri)))) {
          removeFile(r.uri);
          return setProblem({ key: 'ticket.err.save' });
        }
        if (old) removeFile(old);
      } else {
        // No file yet: the crop itself becomes the ticket.
        const a = makeAttachment({ id: newId('att'), uri: r.uri, name: '', mime: r.uri.endsWith('.png') ? 'image/png' : 'image/jpeg', kind: cur.kind, qrCropUri: r.uri });
        if (!(await saveItem(addAttachment(cur, a.role === 'other' ? { ...a, role: 'ticket' } : a)))) {
          removeFile(r.uri);
          return setProblem({ key: 'ticket.err.save' });
        }
      }
      haptic.success();
      setNote('ticket.qrSavedDone');
    });

  const confirmRemove = (a: Attachment) =>
    Alert.alert(t('ticket.removeConfirm', { name: a.name }), t('ticket.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ticket.removeAction'),
        style: 'destructive',
        onPress: async () => {
          // Files go only once the booking no longer lists them.
          if (!(await saveItem(removeAttachment(latest.current, a.id)))) return setProblem({ key: 'error.item.save.body' });
          filesOf(a).forEach((u) => removeFile(u));
        },
      },
    ]);

  const openAttachment = (a: Attachment) => router.push({ pathname: '/ticket/[id]', params: { id: item.id, att: a.id } });

  return (
    <Card>
      <Label>{t('ticket.files')}</Label>
      {item.attachments.length === 0 ? (
        <View style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 18, color: theme.ink }}>
            {t('ticket.filesEmpty')}
          </Text>
          <Body muted>{t('ticket.filesEmptyBody')}</Body>
        </View>
      ) : (
        item.attachments.map((a) => {
          const kind = attachmentKind(a.mime, a.name);
          const meta = [t(`ticket.role.${a.role}`), t(`ticket.kind.${kind}`), a.qrCropUri ? t('ticket.qrSaved') : ''].filter(Boolean).join(' · ');
          return (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('ticket.openFile', { name: a.name })}
                accessibilityHint={`${meta}. ${t('ticket.openFileHint', { name: a.name })}`}
                onPress={() => openAttachment(a)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs }}
              >
                <View style={{ width: 40, height: 40, borderRadius: radius.s, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={a.qrCropUri ? 'qr-code-outline' : kind === 'pdf' ? 'document-outline' : 'image-outline'} size={22} color={theme.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
                    {a.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{meta}</Text>
                </View>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('ticket.remove', { name: a.name })}
                accessibilityHint={t('ticket.removeHint')}
                onPress={() => confirmRemove(a)}
                style={{ width: TOUCH, alignItems: 'center' }}
              >
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </PressableScale>
            </View>
          );
        })
      )}

      {busy ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {t('ticket.adding')}
        </Text>
      ) : null}
      {problem && 'photos' in problem ? (
        <PermissionNotice
          kind="photos"
          state={problem.photos}
          onRetry={problem.photos === 'ask' ? () => add('photos') : undefined}
          onFallback={() => add('files')}
        />
      ) : null}
      {problem && 'key' in problem ? <Warning text={t(problem.key)} /> : null}
      {note ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ok }}>
          {t(note)}
        </Text>
      ) : null}

      <View style={{ gap: space.s, marginTop: space.xs }}>
        {primary ? <Button label={t('ticket.open')} hint={t('ticket.openHint')} onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: item.id } })} /> : null}
        <Button label={t('ticket.chooseFile')} hint={t('ticket.chooseFileHint')} kind="quiet" onPress={() => add('files')} />
        <Button label={t('ticket.choosePhoto')} hint={t('ticket.choosePhotoHint')} kind="quiet" onPress={() => add('photos')} />
        <Button
          label={primary?.qrCropUri ? t('ticket.qrReplace') : item.attachments.length ? t('ticket.qrSet') : t('ticket.qrAdd')}
          hint={t('ticket.qrHint')}
          kind="quiet"
          onPress={saveCrop}
        />
      </View>
    </Card>
  );
}
