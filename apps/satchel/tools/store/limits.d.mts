// Types for tools/store/limits.mjs, so the core typecheck can read src/core/storelimits.test.ts.
export type StoreField = { store: 'ios' | 'play'; field: string; text: string; limit: number; stated?: number };
export declare const chars: (s: string) => number;
export declare const REQUIRED: Record<string, number>;
export declare const BRANDS: RegExp;
export declare const BANNED_CLAIMS: { name: string; re: RegExp }[];
export declare const EMERGENCY_NUMBERS: RegExp;
export declare const VERIFY_LOCALLY: RegExp;
export declare function parseStore(md: string): StoreField[];
export declare function indexedWords(name: string, subtitle: string): Set<string>;
export declare function storeProblems(fields: StoreField[]): string[];
export declare function storeCaptions(md: string): string[];
export declare function screenshotCaptions(md: string): string[];
