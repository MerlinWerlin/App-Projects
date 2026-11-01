// Stubs for Expo modules shared by several features (SDK 57 public API, members Satchel uses). See ../README.md.
declare module 'expo-document-picker' {
  export type DocumentPickerAsset = { uri: string; name: string; size?: number; mimeType?: string; lastModified?: number };
  export type DocumentPickerResult = { canceled: false; assets: DocumentPickerAsset[] } | { canceled: true; assets: null };
  export type DocumentPickerOptions = { type?: string | string[]; copyToCacheDirectory?: boolean; multiple?: boolean };
  export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
}
