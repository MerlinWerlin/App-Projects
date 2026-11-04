// Original line art: a reading room, a book illustration, a garden, a butterfly wing.
import { LevelArt, circle, curve, ellipse, line, petal, poly, rect } from '../core/build.ts';
import type { Scene } from '../core/scene.ts';

function flower(a: LevelArt, x: number, y: number, r: number) {
  a.ink(curve([x, y, x - 10, y + 50, x + 8, y + 100]));
  for (let k = 0; k < 6; k++) a.fill('petal', petal(x, y, k * Math.PI / 3, r * 0.2, r, r * 0.35));
  a.fill('flowerHeart', circle(x, y, r * 0.24));
  a.fill('leaf', petal(x, y + 65, -0.6, 0, 45, 14));
}

function shelves() {
  const a = new LevelArt('shelves');
  a.fill('wall', rect(0, 0, 1200, 900));
  a.fill('floor', rect(0, 740, 1200, 160));
  for (let x = 0; x < 1200; x += 120) a.ink(line([x, 740, x - 160, 900]));
  a.fill('windowFrame', 'M420 400V200C420 30 780 30 780 200V400Z');
  a.fill('window', 'M438 382V200C438 56 762 56 762 200V382Z');
  a.ink(line([600, 78, 600, 380]), 1);
  a.ink(line([438, 248, 762, 248]), 1);
  a.fill('moon', circle(680, 166, 33));
  for (const [x, y] of [[490, 170], [540, 124], [714, 294], [516, 320]]) a.fill('star', poly([x!, y! - 12, x! + 5, y! - 4, x! + 14, y!, x! + 5, y! + 4, x!, y! + 12, x! - 5, y! + 4, x! - 14, y!, x! - 5, y! - 4]));
  for (const x of [50, 850]) {
    a.fill('case', rect(x, 74, 300, 680, 12));
    a.fill('caseBack', rect(x + 14, 90, 272, 640));
    for (let row = 0; row < 4; row++) {
      const y = 230 + row * 155;
      for (let k = 0; k < 7; k++) {
        const bx = x + 26 + k * 36, h = 82 + (k * 17 + row * 19) % 51;
        a.fill('book', rect(bx, y - h, 30, h, 3));
        a.ink(line([bx + 4, y - h + 13, bx + 26, y - h + 13]));
        a.ink(line([bx + 4, y - 12, bx + 26, y - 12]));
        if ((k + row) % 3 === 0) a.fill('spineLabel', rect(bx + 7, y - h + 28, 16, 24, 2));
      }
      a.fill('shelf', rect(x + 10, y, 280, 12, 2));
    }
  }
  a.fill('rug', ellipse(600, 804, 370, 62));
  a.fill('rugInset', ellipse(600, 804, 320, 40));
  for (const x of [390, 770]) a.fill('deskLeg', poly([x, 658, x + 32, 658, x + 46, 830, x + 14, 830]));
  a.fill('desk', rect(340, 620, 520, 70, 8));
  a.fill('bookCover', poly([290, 510, 580, 454, 908, 510, 908, 734, 600, 778, 290, 734]));
  a.fill('pageLeft', 'M310 500Q450 450 600 500V752Q450 710 310 720Z');
  a.fill('pageRight', 'M600 500Q750 450 890 500V720Q750 710 600 752Z');
  for (let y = 534; y < 686; y += 26) a.ink(curve([334, y, 440, y - 14, 568, y + 5]), 0.5);
  a.fill('illustrationFrame', rect(612, 508, 256, 204, 4));
  a.fill('illustration', rect(620, 520, 240, 180));
  // Teacup on the desk, with a little rising curl of steam.
  a.fill('saucer', ellipse(978, 690, 65, 16));
  a.fill('cupHandle', ellipse(1034, 646, 25, 28));
  a.fill('teaCup', 'M930 615H1026V666Q978 712 930 666Z');
  a.fill('tea', ellipse(978, 615, 48, 12));
  a.ink(curve([975, 590, 990, 570, 968, 548, 980, 526]));
  return a.level({});
}

function story() {
  const a = new LevelArt('story');
  a.fill('sky', rect(0, 0, 1200, 900));
  a.fill('sun', circle(1020, 130, 65));
  for (const x of [160, 700]) a.fill('cloud', `M${x} 160C${x - 30} 105 ${x + 30} 65 ${x + 70} 105C${x + 110} 45 ${x + 180} 70 ${x + 180} 118C${x + 250} 110 ${x + 265} 170 ${x + 220} 178H${x + 20}Z`);
  a.fill('farHill', 'M0 480Q240 210 520 480Q850 170 1200 450V900H0Z');
  a.fill('nearHill', 'M0 600Q300 430 600 620Q960 430 1200 620V900H0Z');
  a.fill('castle', rect(330, 320, 540, 420, 8));
  for (const x of [290, 800]) {
    a.fill('tower', rect(x, 250, 110, 480));
    a.fill('towerRoof', poly([x - 20, 250, x + 55, 120, x + 130, 250]));
    for (const y of [300, 410]) a.fill('towerWindow', 'M' + (x + 30) + ' ' + (y + 60) + 'V' + y + 'Q' + (x + 55) + ' ' + (y - 35) + ' ' + (x + 80) + ' ' + y + 'V' + (y + 60) + 'Z');
  }
  for (let x = 410; x <= 740; x += 66) a.fill('battlement', rect(x, 285, 40, 50));
  a.fill('doorFrame', 'M410 738V494C410 330 790 330 790 494V738Z');
  a.fill('gardenDoor', rect(440, 470, 320, 240));
  a.fill('path', 'M440 738H760L1040 900H140Z');
  for (const [x, y] of [[100, 610], [210, 700], [1090, 620], [1000, 750]]) flower(a, x!, y!, 32);
  for (let i = 0; i < 10; i++) a.fill('pathStone', ellipse(360 + (i % 4) * 145, 790 + Math.floor(i / 4) * 36, 32, 10));
  return a.level({ parent: 'shelves', portal: { x: 620, y: 520, w: 240, h: 180 }, stroke: 2.4 });
}

function secret() {
  const a = new LevelArt('secret');
  a.fill('gardenWall', rect(0, 0, 1200, 900));
  for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) {
    const x = col * 150 - (row % 2) * 75;
    a.ink(line([Math.max(0, x), row * 100, Math.min(1200, x + 150), row * 100]));
    if (x > 0) a.ink(line([x, row * 100, x, row * 100 + 100]));
  }
  a.fill('grass', 'M0 700Q300 640 600 710Q900 640 1200 710V900H0Z');
  a.fill('fountainFoot', ellipse(480, 790, 210, 45));
  a.fill('fountainStem', rect(450, 540, 60, 250, 14));
  a.fill('fountainBowl', 'M260 500H700Q670 650 480 650Q290 650 260 500Z');
  a.fill('water', ellipse(480, 500, 220, 40));
  a.ink(curve([480, 500, 430, 350, 350, 380]));
  a.ink(curve([480, 500, 520, 330, 610, 380]));
  for (const [x, y] of [[350, 395], [610, 395], [480, 340]]) a.fill('droplet', ellipse(x!, y!, 12, 22));
  for (const [x, y, r] of [[100, 440, 50], [210, 570, 40], [1000, 620, 50], [1100, 470, 40], [830, 730, 36]]) flower(a, x!, y!, r!);
  // Butterfly: the right upper wing is the next world.
  a.fill('wing', ellipse(670, 340, 135, 145));
  a.fill('wing', ellipse(890, 350, 166, 140));
  a.fill('wing', ellipse(700, 510, 96, 100));
  a.fill('wing', ellipse(870, 515, 98, 95));
  a.fill('wingInset', ellipse(900, 350, 120, 90));
  a.fill('butterflyBody', ellipse(780, 410, 28, 160));
  a.fill('butterflyHead', circle(780, 240, 34));
  for (const side of [-1, 1]) a.ink(curve([780, 220, 780 + side * 40, 175, 780 + side * 65, 195]));
  for (const x of [655, 690, 860, 910]) a.fill('wingSpot', ellipse(x, 516, 17, 27));
  return a.level({ parent: 'story', portal: { x: 440, y: 470, w: 320, h: 240 }, stroke: 2.4 });
}

function wing() {
  const a = new LevelArt('wing');
  a.fill('wingPaper', rect(0, 0, 1200, 900));
  for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
    const x = 90 + col * 170, y = 90 + row * 180;
    a.fill('wingCell', ellipse(x, y, 75, 80));
    a.fill('wingEye', ellipse(x, y, 40, 53));
    a.fill('wingHeart', petal(x, y + 18, -Math.PI / 2, 0, 55, 20));
  }
  return a.level({ parent: 'secret', portal: { x: 780, y: 260, w: 240, h: 180 }, round: true, stroke: 2.4 });
}

export const libraryScene: Scene = { id: 'library', theme: 'cosy', version: 1, palette: 'dusk', levels: [shelves(), story(), secret(), wing()] };
