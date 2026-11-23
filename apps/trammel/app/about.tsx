import { Card, H, P, Screen } from '../src/ui/kit.tsx';

const SECTIONS: [string, string][] = [
  ['Stairs', 'Limits from the National Construction Code 2022 as published by the ABCB: Housing Provisions 11.2.2 and Table 11.2.2a for houses (Class 1 and 10), and Volume One D3D14 and Table D3D14 for public and private stairways (Class 2-9). Riser 115-190 mm; going 240-355 mm (250 minimum for public stairs); 2R+G 550-700 mm; 2-18 risers in a flight; risers and goings kept constant; open risers must not pass a 125 mm sphere. Trammel aims for 2R+G = 630 mm, a comfortable stride. Spiral stairs and winders are not covered.'],
  ['Roof', 'Right-triangle trigonometry: rise = run x tan(pitch), rafter = run / cos(pitch). Regular hips (equal pitches, 45° in plan): hip run = run x √2, hip length = √(hip run² + rise²), creepers shorten by spacing / cos(pitch). These are the same values as the rafter tables on a steel framing square. Birdsmouth notches are checked against the common one-third-of-depth rule; AS 1684 sets the real limits for your timber.'],
  ['Mitres', 'Flat mitre = (180 - corner) / 2. Polygons: 180 / sides. Compound cuts with the piece flat on the saw: bevel = asin(cos spring x cos(corner/2)), mitre = atan(sin spring / tan(corner/2)). For a 90° corner these give 33.9° bevel and 31.6° mitre for 38° spring, and 30.0° / 35.3° for 45° spring, matching the charts printed on mitre saws.'],
  ['Layout and decking', 'End members flush, centres marked from the start end. Decking: full boards = floor((width + gap) / (board + gap)); a leftover under 20 mm is shared out in the gaps instead of ripping a sliver.'],
  ['Cut list', 'A best-fit heuristic for the one-dimensional cutting-stock problem: each length is filled as fully as possible (an exact subset-sum), allowing one saw kerf between pieces, then moved to the shortest stock that still holds it. Good plans, not always the mathematical best.'],
  ['Square and arcs', 'Pythagoras and the 3-4-5 triangle; the law of cosines for how far a frame is out. Arcs: radius = span² / (8 x rise) + rise / 2 (intersecting chords).'],
  ['Check it', 'Trammel is a calculator, not an engineer or a certifier. Check every number against the plans, the engineer’s details, the manufacturer’s instructions and the codes that apply where you build, including state variations.'],
];

export default function About() {
  return (
    <Screen>
      {SECTIONS.map(([h, p]) => (
        <Card key={h}>
          <H>{h}</H>
          <P>{p}</P>
        </Card>
      ))}
    </Screen>
  );
}
