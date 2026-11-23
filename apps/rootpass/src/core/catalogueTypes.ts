/** Shapes of the stocked-steel catalogue (data in catalogue.ts, helpers in stock.ts). */
export interface Group<T> { items: T[]; src: string; verified: boolean; partial?: boolean; note?: string }
/** a × b outside (flat: a = width), walls = thicknesses stocked; in the catalogue's unit. */
export interface Section { a: number; b: number; walls: number[] }
export interface Tube { od: number; walls: number[] }
export interface PipeEntry { name: string; od: number; walls: Record<string, number> }

export interface Catalogue {
  unit: 'mm' | 'in';
  shs: Group<Section>;
  rhs: Group<Section>;
  chs: Group<Tube>;
  angle: Group<Section>;
  flat: Group<Section>;
  plate: Group<number>;
  round: Group<number>;
  lengths: { unit: 'mm' | 'ft'; tube: number[]; bar: number[]; src: string };
  pipe: { series: string; sizes: PipeEntry[]; src: string };
  notes: string;
}

export type CatalogueSet = Record<'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA', Catalogue>;
