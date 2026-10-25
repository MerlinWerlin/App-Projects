// Add / edit a vault document: type (radio chips), name, expiry typed as YYYY-MM-DD (no date-picker module needed
// in Expo Go), copies from Photos or Files (copied into the app, never uploaded). Behind the vault lock.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { newId, type Attachment } from '../src/core/model.ts';
import type { PermissionState } from '../src/core/permissions.ts';
import {
  DOC_KINDS,
  docFromDraft,
  draftFromDoc,
  droppedFiles,
  isImage,
  newDocDraft,
  requiresUnlock,
  upsertDoc,
  validateDoc,
  type DocDraft,
  type DocError,
} from '../src/core/vault.ts';
import { pickFile, pickPhoto } from '../src/native/docPick.ts';
import { copyIntoApp, removeFile } from '../src/native/files.ts';
import { useApp } from '../src/state/app.tsx';
import { useVaultDocs, useVaultLock } from '../src/state/vaultLock.ts';
import { fonts, radius, space } from '../src/theme/tokens.ts';
import { Body, Button, Chip, Label, PressableScale, Screen, TextField, Warning } from '../src/ui/kit.tsx';
import { useDiscardConfirm } from '../src/ui/discardConfirm.ts';
import { PermissionNotice } from '../src/ui/PermissionNotice.tsx';
import { DOC_ICON, docKindKey, VaultLockGate } from '../src/ui/slots/WalletVaultSlot.tsx';

export default function DocEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, theme } = useApp();
  const router = useRouter();
  const lock = useVaultLock();
  const [docs, setDocs] = useVaultDocs();
  const prev = id ? docs.find((d) => d.id === id) : undefined;
  const [d, setD] = useState<DocDraft>(() => (prev ? draftFromDoc(prev) : newDocDraft()));
  const initial = useRef<string>(JSON.stringify(d));
  const filled = useRef(!!prev || !id);
  const [errors, setErrors] = useState<DocError[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<{ denied: Exclude<PermissionState, 'granted'> } | 'error' | null>(null);
  /** Files copied in this session; deleted on leave unless saved in the document. */
  const added = useRef<string[]>([]);
  const savedUris = useRef<string[] | null>(null);
  const alive = useRef(true);
  // Header back, Android back, swipe-down and Cancel all ask before throwing away changes (src/ui/discardConfirm.ts).
  const { leaving, gestureEnabled } = useDiscardConfirm(JSON.stringify(d) !== initial.current);

  // Editing a document that was still loading from storage: fill the form once it arrives.
  useEffect(() => {
    if (!filled.current && prev) {
      filled.current = true;
      const next = draftFromDoc(prev);
      initial.current = JSON.stringify(next);
      setD(next);
    }
  }, [prev]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const keep = savedUris.current ?? [];
      added.current.filter((u) => !keep.includes(u)).forEach((u) => removeFile(u));
    };
  }, []);

  const add = async (from: 'photo' | 'file') => {
    if (busy) return;
    setPickError(null);
    setBusy(true);
    const r = from === 'photo' ? await pickPhoto() : await pickFile();
    if (!r.ok) {
      if (alive.current) {
        setBusy(false);
        if (r.reason === 'denied') setPickError({ denied: r.permission && r.permission !== 'granted' ? r.permission : 'blocked' });
        else if (r.reason !== 'cancelled') setPickError('error');
      }
      return;
    }
    const attId = newId('att');
    const saved = await copyIntoApp(r.file.uri, 'vault', attId, r.file.name);
    if (!saved.ok) {
      if (alive.current) {
        setBusy(false);
        setPickError('error');
      }
      return;
    }
    if (!alive.current) {
      removeFile(saved.uri);
      return;
    }
    added.current.push(saved.uri);
    const att: Attachment = { id: attId, uri: saved.uri, name: r.file.name, mime: r.file.mime, role: 'other' };
    setD((o) => ({ ...o, attachments: [...o.attachments, att] }));
    setBusy(false);
  };

  const removeCopy = (attId: string) => setD((o) => ({ ...o, attachments: o.attachments.filter((a) => a.id !== attId) }));

  const save = () => {
    const e = validateDoc(d);
    setErrors(e);
    if (e.length || busy) return;
    const doc = docFromDraft(d, prev?.id ?? newId('doc'));
    setDocs((old) => upsertDoc(old, doc));
    const keep = doc.attachments.map((a) => a.uri);
    savedUris.current = keep;
    // Copies removed from a saved document are deleted now (new, unsaved ones by the unmount cleanup).
    droppedFiles(prev?.attachments ?? [], doc.attachments).forEach((u) => removeFile(u));
    leaving();
    router.back();
  };

  const title = prev ? t('doc.editTitle') : t('doc.newTitle');
  if (requiresUnlock(lock)) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <VaultLockGate autoPrompt />
      </>
    );
  }

  const err = (k: DocError) => (errors.includes(k) ? t(`doc.err.${k}`) : undefined);

  return (
    <Screen>
      <Stack.Screen options={{ title, gestureEnabled }} />
      <View style={{ gap: space.s }}>
        <Label>{t('doc.kindLabel')}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('doc.kindLabel')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {DOC_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(docKindKey(k))}
              selected={d.kind === k}
              onPress={() => setD((o) => ({ ...o, kind: k }))}
              icon={<Ionicons name={DOC_ICON[k]} size={18} color={theme.ink} />}
            />
          ))}
        </View>
      </View>
      <TextField
        label={t('doc.labelField')}
        value={d.label}
        onChange={(v) => setD((o) => ({ ...o, label: v }))}
        placeholder={t('doc.labelPlaceholder')}
        error={err('label')}
      />
      <TextField
        label={t('doc.expiresField')}
        value={d.expires}
        onChange={(v) => setD((o) => ({ ...o, expires: v }))}
        placeholder={t('doc.expiresPlaceholder')}
        autoCapitalize="none"
        error={err('expires')}
      />

      <View style={{ gap: space.s }}>
        <Label>{t('doc.copiesTitle')}</Label>
        {d.attachments.map((a) => (
          <View
            key={a.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, borderWidth: 1, borderColor: theme.line, borderRadius: radius.s, paddingLeft: space.m, backgroundColor: theme.card }}
          >
            <Ionicons name={isImage(a) ? 'image-outline' : 'document-outline'} size={20} color={theme.ink} />
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink, flex: 1 }} numberOfLines={1}>
              {a.name}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('doc.removeCopy', { name: a.name })}
              accessibilityHint={t('doc.removeCopyHint')}
              onPress={() => removeCopy(a.id)}
              style={{ minWidth: 48, alignItems: 'center' }}
            >
              <Ionicons name="close-circle-outline" size={24} color={theme.danger} />
            </PressableScale>
          </View>
        ))}
        {busy ? <Body muted>{t('doc.copying')}</Body> : null}
        {pickError && pickError !== 'error' ? (
          <PermissionNotice
            kind="photos"
            state={pickError.denied}
            onRetry={pickError.denied === 'ask' ? () => add('photo') : undefined}
            onFallback={() => add('file')}
          />
        ) : null}
        {pickError === 'error' ? <Warning text={t('doc.err.pick')} /> : null}
        <Button label={t('doc.addPhoto')} hint={t('doc.addPhotoHint')} kind="quiet" onPress={() => add('photo')} />
        <Button label={t('doc.addFile')} hint={t('doc.addFileHint')} kind="quiet" onPress={() => add('file')} />
      </View>

      <Body muted>{t('vault.privacy')}</Body>
      <Button label={t('doc.save')} onPress={save} />
      <Button label={t('common.cancel')} kind="quiet" onPress={() => router.back()} />
    </Screen>
  );
}
