import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { decodePetStatus, type PetId, type PetMood, type PetStatus } from '../core/islandPets';
import type { PetActivityState } from '../core/petLife';

type NativePets = {
  status(): Promise<unknown>;
  start(pet: PetId): Promise<unknown>;
  mood(id: string, mood: PetMood): Promise<unknown>;
  stop(): Promise<unknown>;
  /** T188, new native build only: start / update with a petLife content state (JSON). */
  startLife?(pet: PetId, state: string): Promise<unknown>;
  life?(id: string, state: string): Promise<unknown>;
};
function native(): NativePets | null {
  if (Platform.OS !== 'ios' || Constants.appOwnership === 'expo') return null;
  try { return requireOptionalNativeModule<NativePets>('GlazeIslandPets'); } catch { return null; }
}
export const petsSupported = () => native() !== null;
export async function readPetStatus(): Promise<PetStatus> {
  const mod = native();
  if (!mod) throw new Error('Native pet feature unavailable');
  return decodePetStatus(await mod.status());
}
export async function startPet(pet: PetId): Promise<PetStatus> {
  const mod = native(); if (!mod) throw new Error('Native pet feature unavailable');
  return decodePetStatus(await mod.start(pet));
}
export async function changePetMood(id: string, mood: PetMood): Promise<PetStatus> {
  const mod = native(); if (!mod) throw new Error('Native pet feature unavailable');
  return decodePetStatus(await mod.mood(id, mood));
}
export async function stopPet(): Promise<PetStatus> {
  const mod = native(); if (!mod) throw new Error('Native pet feature unavailable');
  return decodePetStatus(await mod.stop());
}

// T188: pet life on the Island. Sent only at petLife boundaries (src/store/pets.ts). Builds
// without the life functions (older native code reached by an OTA update) fall back to the three
// legacy poses through start/mood, so nothing crashes and the pet still changes pose.
export type PetActivityPayload = PetActivityState & { name?: string };
const hasLife = (mod: NativePets) => typeof mod.startLife === 'function' && typeof mod.life === 'function';
export const petLifeSupported = () => { const mod = native(); return mod !== null && hasLife(mod); };
export async function startPetLife(pet: PetId, state: PetActivityPayload): Promise<PetStatus> {
  const mod = native(); if (!mod) throw new Error('Native pet feature unavailable');
  if (hasLife(mod) && mod.startLife) return decodePetStatus(await mod.startLife(pet, JSON.stringify(state)));
  const started = decodePetStatus(await mod.start(pet));
  if (!started.session || started.session.mood === state.mood) return started;
  return decodePetStatus(await mod.mood(started.session.id, state.mood));
}
export async function updatePetLife(id: string, state: PetActivityPayload): Promise<PetStatus> {
  const mod = native(); if (!mod) throw new Error('Native pet feature unavailable');
  if (hasLife(mod) && mod.life) return decodePetStatus(await mod.life(id, JSON.stringify(state)));
  return decodePetStatus(await mod.mood(id, state.mood));
}
