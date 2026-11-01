// Curated palettes. Names are i18n keys (palette.<id>). Colours are plain hex so saves stay tiny.
export type Palette = { id: string; colors: string[] };

export const PALETTES: Palette[] = [
  {
    id: 'cosy',
    colors: ['#7A4E2D', '#A86B3C', '#D39B5B', '#E9C893', '#F5E6C8', '#B5523B', '#D9805F', '#8C9A5B', '#5E7349', '#3E5641', '#2F4858', '#4F6D8C', '#C9A227', '#E8B4A0', '#9B6A8F', '#3B2A24'],
  },
  {
    id: 'garden',
    colors: ['#2E5E3A', '#3F7D4E', '#6FA35A', '#A7C957', '#D9E8A4', '#F2E8CF', '#F7B32B', '#F28F3B', '#C8553D', '#E07A9A', '#F5B8C8', '#B497D6', '#7B5EA7', '#5DA9E9', '#2D6A8F', '#6B4F3A'],
  },
  {
    id: 'jewel',
    colors: ['#0B3D59', '#126E82', '#1F9E89', '#5CC8A5', '#132A13', '#31572C', '#6A040F', '#9D0208', '#D00000', '#E85D04', '#FFBA08', '#3C096C', '#5A189A', '#9D4EDD', '#C77DFF', '#14213D'],
  },
  {
    id: 'pastel',
    colors: ['#FFD6E0', '#FFB5C2', '#FFC9A9', '#FFE5A3', '#FFF5BA', '#D7F2C4', '#B5EAD7', '#A8DADC', '#BDE0FE', '#A2D2FF', '#CDB4DB', '#E2C2FF', '#F1E3D3', '#E8D5C4', '#C9C9C9', '#8D99AE'],
  },
  {
    id: 'dusk',
    colors: ['#1B1F3B', '#2E3A6E', '#4B5BA6', '#7A8CD9', '#B8C4F2', '#F4D58D', '#F2A65A', '#E0605C', '#B23A48', '#6D2E46', '#A26769', '#D5B9B2', '#ECE2D0', '#5B8E7D', '#2F5D50', '#111111'],
  },
];

export const ERASE = 'erase';

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}
