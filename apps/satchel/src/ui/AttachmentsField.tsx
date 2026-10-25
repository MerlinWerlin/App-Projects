// Item form Attachments section (T44, FLOWS §4.1 item 6 and §5.1; ACCESSIBILITY "Add or edit item"). Lists the
// files on the booking being edited, adds from Files or Photos through the source chooser, and removes. It edits
// the form's draft list only: the screen saves the list with the booking and deletes files after Save or Cancel
// (src/core/tickets.ts droppedFiles), so Cancel / Discard leaves the saved booking exactly as it was.
// Picking and copying reuse the T04 adapter (src/native/pickers.ts importAttachment), which never throws.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { attachmentKind } from '../core/tickets.ts';
import type { Attachment, ItemKind } from '../core/model.ts';
import { haptic } from '../native/device.ts';
import { importAttachment } from '../native/pickers.ts';
import { useApp } from '../state/app.tsx';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';
import { Body, Button, Card, Label, PressableScale, Warning } from './kit.tsx';
import { PermissionNotice } from './PermissionNotice.tsx';
import { failureKey, type Problem } from './slots/ItemTicketSlot.tsx';

export type AttachmentsFieldProps = {
  /** The draft list shown in the form. */
  attachments: Attachment[];
  /** Kind of the booking (sets a new file's role: ticket, booking or other). */
  kind: ItemKind;
  /** A file was picked and copied into Satchel; append it to the draft. */
  onAdd: (a: Attachment) => void;
  /** Take a file off the draft (its copy is deleted once the booking is saved). */
  onRemove: (a: Attachment) => void;
  /** Ids already saved on the booking: removing one of those asks first. */
  savedIds: ReadonlySet<string>;
};

export function AttachmentsField({ attachments, kind, onAdd, onRemove, savedIds }: AttachmentsFieldProps) {
  const { t, theme } = useApp();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);

  const add = async (source: 'files' | 'photos') => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await importAttachment(source, kind);
      if (!r.ok) return setProblem(failureKey(r.reason, false, r.permission));
      onAdd(r.attachment);
      haptic.success();
    } finally {
      setBusy(false);
    }
  };

  // FLOWS §5.1 source chooser: Choose from Files, Choose from Photos, Cancel.
  const choose = () =>
    Alert.alert(t('itemEdit.attachmentAdd'), undefined, [
      { text: t('itemEdit.attachmentFromFiles'), onPress: () => add('files') },
      { text: t('itemEdit.attachmentFromPhotos'), onPress: () => add('photos') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  // A file added in this form has nothing saved to lose, so it goes at once; a saved one asks first.
  const remove = (a: Attachment) => {
    if (!savedIds.has(a.id)) return onRemove(a);
    Alert.alert(t('ticket.removeConfirm', { name: a.name }), t('ticket.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ticket.removeAction'), style: 'destructive', onPress: () => onRemove(a) },
    ]);
  };

  return (
    <Card>
      <View accessibilityRole="header">
        <Label>{t('itemEdit.attachments')}</Label>
      </View>
      {attachments.length === 0 ? <Body muted>{t('itemEdit.attachmentsEmpty')}</Body> : null}
      {attachments.map((a) => {
        const fileKind = attachmentKind(a.mime, a.name);
        const meta = [t(`ticket.role.${a.role}`), t(`ticket.kind.${fileKind}`), a.qrCropUri ? t('ticket.qrSaved') : ''].filter(Boolean).join(' · ');
        return (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: TOUCH }}>
            <View accessible accessibilityLabel={`${t('itemEdit.attachmentRow', { name: a.name })}, ${meta}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.s, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={a.qrCropUri ? 'qr-code-outline' : fileKind === 'pdf' ? 'document-outline' : 'image-outline'} size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
                  {a.name}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{meta}</Text>
              </View>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('itemEdit.attachmentRemove', { name: a.name })}
              accessibilityHint={t('itemEdit.attachmentRemoveHint')}
              onPress={() => remove(a)}
              style={{ width: TOUCH, alignItems: 'center' }}
            >
              <Ionicons name="trash-outline" size={22} color={theme.danger} />
            </PressableScale>
          </View>
        );
      })}
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {t('ticket.adding')}
        </Text>
      ) : null}
      {problem && 'photos' in problem ? (
        <PermissionNotice kind="photos" state={problem.photos} onRetry={problem.photos === 'ask' ? () => add('photos') : undefined} onFallback={() => add('files')} />
      ) : null}
      {problem && 'key' in problem ? <Warning text={t(problem.key)} /> : null}
      <Button label={t('itemEdit.attachmentAdd')} hint={t('itemEdit.attachmentAddHint')} kind="quiet" onPress={choose} />
      {attachments.length || savedIds.size ? <Body muted>{t('itemEdit.attachmentsNote')}</Body> : null}
    </Card>
  );
}
