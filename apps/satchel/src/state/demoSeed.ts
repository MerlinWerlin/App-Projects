// Demo trip extras (T33): the sample ticket image, the sample passport in the vault and the sample emergency
// details, seeded with the demo trip and taken away with it. Best effort: a phone that can't write the files still
// gets the demo trip (just without the sample images). Never throws.
import { deviceZone, todayIn } from '../core/format.ts';
import type { Attachment, EmergencyCard, TravelDoc, Trip } from '../core/model.ts';
import { DEMO_DOC_ID, DEMO_PASSPORT_FILE, DEMO_TICKET_FILE, sampleDoc, samplePassportAttachment, sampleTicketAttachment, withoutSampleCard, withoutSampleDoc, withSampleCard, withSampleDoc, withSampleTicket } from '../core/demoExtras.ts';
import { EMERGENCY_KEY, EMPTY_CARD } from '../core/emergency.ts';
import { encodePng, samplePassportBitmap, sampleTicketBitmap, toBase64 } from '../core/samplePng.ts';
import { cleanDocs } from '../core/vault.ts';
import { removeAppFiles, writeAppFile } from '../native/files.ts';
import { readPersisted, setPersisted } from './persisted.ts';
import { VAULT_KEY } from './vaultLock.ts';

const NO_DOCS: TravelDoc[] = [];

async function writeSample(folder: 'attachments' | 'vault', name: string, png: () => Uint8Array): Promise<string | null> {
  try {
    const r = await writeAppFile(folder, name, toBase64(png()));
    return r.ok ? r.uri : null;
  } catch {
    return null;
  }
}

/** The demo trip with its sample ticket attached (when the image could be written). */
export async function demoWithTicket(trip: Trip): Promise<Trip> {
  const uri = await writeSample('attachments', DEMO_TICKET_FILE, () => encodePng(sampleTicketBitmap()));
  return uri ? withSampleTicket(trip, sampleTicketAttachment(uri)) : trip;
}

/** Adds the sample passport to the vault (once) and fills an empty emergency card with the sample details. */
export async function seedDemoExtras(): Promise<void> {
  try {
    const docs = cleanDocs(await readPersisted<TravelDoc[]>(VAULT_KEY, NO_DOCS));
    if (!docs.some((d) => d.id === DEMO_DOC_ID)) {
      const uri = await writeSample('vault', DEMO_PASSPORT_FILE, () => encodePng(samplePassportBitmap()));
      const attachment: Attachment | undefined = uri ? samplePassportAttachment(uri) : undefined;
      const doc = sampleDoc(todayIn(deviceZone()), attachment);
      setPersisted<TravelDoc[]>(VAULT_KEY, (old) => withSampleDoc(cleanDocs(old), doc), NO_DOCS);
    }
    await readPersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
    setPersisted<EmergencyCard>(EMERGENCY_KEY, (old) => withSampleCard(old), EMPTY_CARD);
  } catch {
    // the demo trip still works without its extras
  }
}

/** Removing the demo trip takes the sample passport (and its file) and the untouched sample card with it. */
export async function removeDemoExtras(): Promise<void> {
  try {
    const docs = cleanDocs(await readPersisted<TravelDoc[]>(VAULT_KEY, NO_DOCS));
    const sample = docs.find((d) => d.id === DEMO_DOC_ID);
    if (sample) {
      setPersisted<TravelDoc[]>(VAULT_KEY, (old) => withoutSampleDoc(cleanDocs(old)), NO_DOCS);
      removeAppFiles(sample.attachments.map((a) => a.uri)).catch(() => {});
    }
    await readPersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
    setPersisted<EmergencyCard>(EMERGENCY_KEY, (old) => (old && typeof old === 'object' ? withoutSampleCard(old) : old), EMPTY_CARD);
  } catch {
    // best effort: leftovers are labelled sample and can be removed by hand
  }
}
