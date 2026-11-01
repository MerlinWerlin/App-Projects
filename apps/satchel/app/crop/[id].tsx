// T28 crop screen for a booking's ticket image (Params: id = booking id, att = attachment id). The editor itself is
// src/ui/CropEditor.tsx (shared with vault documents, app/doc-crop/[id].tsx, since T155).
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CropRect } from '../../src/core/qrcrop.ts';
import { setCropRect } from '../../src/core/qrcrop.ts';
import { removeFile } from '../../src/native/files.ts';
import { useApp } from '../../src/state/app.tsx';
import { findItem, useTrips } from '../../src/state/trips.tsx';
import { CropEditor } from '../../src/ui/CropEditor.tsx';

export default function CropScreen() {
  const { id, att } = useLocalSearchParams<{ id: string; att?: string }>();
  const { t } = useApp();
  const { trips, saveItem } = useTrips();
  const router = useRouter();

  const item = findItem(trips, id)?.item;
  const a = item?.attachments.find((x) => x.id === att) ?? null;

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (item) router.replace(`/item/${item.id}`);
  };

  const save = async (next: CropRect | null) => {
    if (!item || !a) return false;
    const latest = findItem(trips, item.id)?.item ?? item;
    const { item: updated, dropped } = setCropRect(latest, a.id, next);
    if (!(await saveItem(updated))) return false;
    if (dropped) removeFile(dropped);
    return true;
  };

  return <CropEditor a={a} notFound={t('item.notFound')} onSave={save} onClose={close} />;
}
