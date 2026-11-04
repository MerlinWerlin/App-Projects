// Original line art: an old oak opens into an owl's home, its feather, then a leafy world.
import { LevelArt, circle, curve, ellipse, line, petal, poly, rect } from '../core/build.ts';
import type { Scene } from '../core/scene.ts';

function mushroom(a: LevelArt, x: number, y: number, r: number) {
  a.fill('mushroomStem', rect(x - r * 0.18, y, r * 0.36, r, 8));
  a.fill('mushroomCap', `M${x - r} ${y}Q${x} ${y - r * 1.7} ${x + r} ${y}Z`);
  for (const side of [-1, 1]) a.fill('capSpot', circle(x + side * r * 0.4, y - r * 0.25, r * 0.1));
}

function oak() {
  const a = new LevelArt('oak');
  a.fill('sky', rect(0, 0, 1200, 900));
  a.fill('ground', 'M0 720Q310 640 610 740Q900 660 1200 700V900H0Z');
  for (const x of [60, 1070]) {
    a.fill('farTrunk', rect(x, 150, 55, 600, 12));
    a.fill('farCanopy', ellipse(x + 25, 205, 165, 180));
  }
  a.fill('oakTrunk', 'M330 830Q480 720 450 480L360 310L430 270L540 400L555 210H650L680 400L820 270L880 320L740 510Q700 730 900 830Q760 880 630 800Q470 880 330 830Z');
  for (let k = 0; k < 12; k++) {
    const angle = k * Math.PI * 2 / 12;
    a.fill('canopy', ellipse(610 + Math.cos(angle) * 310, 240 + Math.sin(angle) * 145, 150, 120));
  }
  for (let k = 0; k < 17; k++) {
    const x = 260 + (k * 113) % 690, y = 110 + (k * 43) % 220;
    a.fill('oakLeaf', petal(x, y, k * 0.7, 0, 70, 25));
  }
  for (const x of [480, 540, 670, 720]) a.ink(curve([x, 630, x - 12, 690, x + 16, 752]));
  a.fill('hollowRim', ellipse(600, 490, 155, 125));
  a.fill('hollowDoor', ellipse(600, 490, 120, 90));
  for (const [x, y, r] of [[170, 750, 60], [260, 800, 40], [960, 760, 52], [1060, 810, 35]]) mushroom(a, x!, y!, r!);
  for (let i = 0; i < 10; i++) a.fill('fallenLeaf', petal(170 + i * 96, 840 + (i % 2) * 27, (i % 3) - 1, 0, 45, 15));
  return a.level({});
}

function hollow() {
  const a = new LevelArt('hollow');
  a.fill('wood', rect(0, 0, 1200, 900));
  for (let x = 40; x < 1200; x += 70) a.ink(curve([x, 0, x - 35, 210, x + 25, 480, x - 10, 900]), 0.5);
  a.fill('home', ellipse(600, 430, 490, 390));
  a.fill('branch', 'M80 740Q500 640 1120 710L1120 765Q500 710 80 800Z');
  for (const x of [180, 980]) {
    a.fill('branchLeaf', petal(x, 730, x < 500 ? -2 : -1, 0, 100, 30));
  }
  a.fill('owlBody', ellipse(600, 490, 260, 250));
  a.fill('earLeft', poly([365, 350, 375, 150, 520, 260]));
  a.fill('earRight', poly([680, 260, 825, 150, 835, 350]));
  a.fill('owlHead', ellipse(600, 325, 250, 190));
  for (const x of [485, 715]) {
    a.fill('face', ellipse(x, 320, 112, 125));
    a.fill('eye', circle(x, 315, 49));
    a.fill('pupil', circle(x, 315, 24));
    a.fill('eyeShine', circle(x - 7, 305, 8));
  }
  a.fill('beak', poly([570, 355, 630, 355, 600, 408]));
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const x = 454 + col * 65, y = 490 + row * 50;
    a.fill('chestFeather', petal(x, y, Math.PI / 2, 0, 43, 20));
  }
  a.fill('leftWing', ellipse(398, 540, 92, 176));
  a.fill('rightWing', ellipse(770, 550, 150, 130));
  a.fill('featherInset', ellipse(770, 550, 120, 90));
  for (const x of [500, 690]) {
    for (let k = -1; k <= 1; k++) a.fill('claw', ellipse(x + k * 23, 728, 12, 30));
  }
  a.fill('lantern', rect(190, 230, 80, 120, 12));
  a.fill('lanternGlass', rect(202, 246, 56, 86, 8));
  a.ink(line([230, 100, 230, 230]));
  a.fill('candle', rect(220, 290, 20, 40, 3));
  a.fill('flame', petal(230, 288, -Math.PI / 2, 0, 40, 12));
  return a.level({ parent: 'oak', portal: { x: 480, y: 400, w: 240, h: 180 }, round: true, stroke: 2.4 });
}

function feather() {
  const a = new LevelArt('feather');
  a.fill('featherPaper', rect(0, 0, 1200, 900));
  a.fill('feather', 'M580 850C80 540 220 30 600 45C980 30 1110 520 580 850Z');
  for (let row = 0; row < 8; row++) {
    const y = 120 + row * 80, spread = 130 + Math.sin(row / 8 * Math.PI) * 150;
    for (const side of [-1, 1]) {
      a.fill('featherBarb', petal(600, y + 80, side < 0 ? -2.65 : -0.5, 12, spread, 30));
      a.fill('featherSpot', ellipse(600 + side * spread * 0.65, y + 15, 24, 18));
    }
  }
  a.fill('quill', 'M585 50H610L600 850L580 884L574 876Z');
  a.fill('dewRim', ellipse(590, 450, 142, 112));
  a.fill('dew', ellipse(590, 450, 120, 90));
  for (const x of [80, 1080]) for (let k = 0; k < 5; k++) a.fill('borderLeaf', petal(x, 180 + k * 140, x < 500 ? -0.5 : -2.6, 0, 95, 32));
  return a.level({ parent: 'hollow', portal: { x: 650, y: 460, w: 240, h: 180 }, round: true, stroke: 2.4 });
}

function dew() {
  const a = new LevelArt('dew');
  a.fill('leafPaper', rect(0, 0, 1200, 900));
  a.fill('leaf', 'M30 820Q80 40 1160 80Q1110 860 30 820Z');
  a.ink(curve([40, 810, 500, 470, 1150, 90]), 1.2);
  for (let i = 0; i < 8; i++) {
    const x = 170 + i * 120, y = 745 - i * 77;
    a.ink(curve([x, y, x - 30, y - 160, x + 50, 140 + i * 4]));
    a.ink(curve([x, y, x + 130, y + 40, 1000 + i * 15, y + 70]));
  }
  a.fill('snailFoot', 'M270 700Q360 660 700 680L760 575Q810 570 808 640L780 730Q510 790 270 730Z');
  a.fill('snailShell', circle(490, 570, 150));
  a.fill('shellRing', circle(490, 570, 105));
  a.fill('shellRing', circle(490, 570, 60));
  a.fill('shellHeart', circle(490, 570, 24));
  for (const x of [750, 800]) {
    a.ink(line([x, 610, x + 8, 535]));
    a.fill('snailEye', circle(x + 8, 530, 12));
  }
  for (const [x, y, r] of [[220, 290, 40], [910, 410, 52], [920, 680, 35], [420, 230, 30]]) {
    a.fill('dewdrop', ellipse(x!, y!, r!, r! * 0.8));
    a.fill('dewShine', ellipse(x! - r! * 0.3, y! - r! * 0.22, r! * 0.18, r! * 0.12));
  }
  for (let k = 0; k < 10; k++) {
    const angle = k * Math.PI / 5;
    a.fill('tinyPetal', petal(160, 650, angle, 14, 55, 12));
  }
  a.fill('flowerHeart', circle(160, 650, 18));
  return a.level({ parent: 'feather', portal: { x: 470, y: 360, w: 240, h: 180 }, round: true, stroke: 2.4 });
}

export const forestScene: Scene = { id: 'forest', theme: 'animals', version: 1, palette: 'garden', levels: [oak(), hollow(), feather(), dew()] };
