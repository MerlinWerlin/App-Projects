/** A message: plain text with {placeholders}, or plural forms (CLDR categories) selected by {count}. */
export type PluralForms = { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string };
export type Msg = string | PluralForms;
