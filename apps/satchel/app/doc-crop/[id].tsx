// T155 crop screen for a vault document's image copy (a visa, a health certificate or an e-ticket with a QR code):
// the same editor as tickets (src/ui/CropEditor.tsx). Behind the vault lock and the app-switcher cover like the
// document screen. The crop is a rectangle saved on the document's copy (src/core/vaultcopy.ts); the file is never
// changed and nothing leaves the phone. Params: id = document id, att = attachment id.
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CropRect } from '../../src/core/qrcrop.ts';
import { requiresUnlock } from '../../src/core/vault.ts';
import { cropTarget, setDocCrop } from '../../src/core/vaultcopy.ts';
import { removeFile } from '../../src/native/files.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePrivacyGuard } from '../../src/state/privacyGuard.ts';
import { useVaultDocs, useVaultLock } from '../../src/state/vaultLock.ts';
import { CropEditor } from '../../src/ui/CropEditor.tsx';
import { VaultLockGate } from '../../src/ui/slots/WalletVaultSlot.tsx';

export default function DocCropScreen() {
  const { id, att } = useLocalSearchParams<{ id: string; att?: string }>();
  const { t } = useApp();
  const router = useRouter();
  const lock = useVaultLock();
  usePrivacyGuard();
  const [docs, setDocs, loaded] = useVaultDocs();
  const target = cropTarget(docs, id, att);

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (id) router.replace({ pathname: '/doc/[id]', params: { id } });
  };

  const save = async (next: CropRect | null) => {
    if (!target) return false;
    // The vault store applies the change at once, so the result is known straight after.
    const out: { r: ReturnType<typeof setDocCrop> | null } = { r: null };
    setDocs((old) => {
      out.r = setDocCrop(old, target.doc.id, target.copy.id, next);
      return out.r.docs;
    });
    if (!out.r?.found) return false;
    if (out.r.dropped) removeFile(out.r.dropped);
    return true;
  };

  if (requiresUnlock(lock)) return <VaultLockGate autoPrompt />;
  if (!loaded) return null;
  return (
    <CropEditor
      a={target?.copy ?? null}
      notFound={t('doc.notFound')}
      body={t('f109.crop.docBody')}
      imageLabel={t('f109.crop.docImageLabel')}
      onSave={save}
      onClose={close}
    />
  );
}
