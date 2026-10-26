import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { decodePetStatus, type PetId, type PetMood, type PetStatus } from '../core/islandPets';

type NativePets = {
  status(): Promise<unknown>;
  start(pet: PetId): Promise<unknown>;
  mood(id: string, mood: PetMood): Promise<unknown>;
  stop(): Promise<unknown>;
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
