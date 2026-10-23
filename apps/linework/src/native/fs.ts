// The only module that imports expo-file-system (oversight D5-1).
// Everything else does `import * as FileSystem from '<path>/native/fs'`.
// The app uses the classic API (documentDirectory, cacheDirectory, getInfoAsync,
// makeDirectoryAsync, copyAsync, readDirectoryAsync, writeAsStringAsync,
// deleteAsync, EncodingType), which SDK 54 serves from 'expo-file-system/legacy'.
// If an Expo SDK bump drops the /legacy entry point, fix it here only:
// re-implement these names on the new File/Directory/Paths API.
export * from 'expo-file-system/legacy';
