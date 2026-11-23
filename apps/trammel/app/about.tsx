import { Card, H, P, Screen } from '../src/ui/kit.tsx';

const SECTIONS: [string, string][] = [
  ['Stairs', 'Trammel checks a straight flight against the code for the country you chose, read from the official text: Australia, NCC 2022 Housing Provisions 11.2.2 and Volume One D3D14; New Zealand, NZBC D1/AS1 Table 6; England, Approved Document K Table 1.1; Ireland, TGD K 2014 Table 1; United States, the 2024 IRC R318.7 and IBC 1011.5; Canada, NBC 2020 Tables 9.8.4.1 and 9.8.4.2. Each limit the code sets (riser, going or run, 2R+G, pitch, risers or rise per flight) is checked; limits a code does not set are left alone. Anywhere else, no code is claimed and Trammel only suggests a comfortable stair (2R+G 600-650 mm). Spiral stairs and winders are not covered; state, provincial and local amendments are not checked.'],
  ['Timber sizes', 'The sections, decking boards and stock lengths offered for each country were read from the big local hardware chains and timber merchants in November 2026. Stock varies by branch, so every list keeps a custom entry. Anywhere else, Trammel offers generic metric sizes and says so.'],
  ['Roof', 'Right-triangle trigonometry: rise = run x tan(pitch), rafter = run / cos(pitch). Regular hips (equal pitches, 45° in plan): hip run = run x √2, hip length = √(hip run² + rise²), creepers shorten by spacing / cos(pitch). These are the same values as the rafter tables on a steel framing square. Birdsmouth notches are checked against the common one-third-of-depth rule; your local framing code sets the real limits for your timber.'],
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
