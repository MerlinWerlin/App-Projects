// Shapes: geometric warm-ups on a 400×400 canvas.
import type { Template } from '../templates.ts';
import { circle, line, ngon, poly, spiral, star } from './draw.ts';

const VB = '0 0 400 400';

const cube: Template = {
  id: 'perspective-cube',
  name: 'Cube in perspective',
  category: 'shapes',
  viewBox: VB,
  paths: [
    // front face
    poly([[110, 170], [250, 170], [250, 310], [110, 310]]),
    // back face (receding up and right)
    poly([[180, 100], [310, 100], [310, 230], [180, 230]]),
    // connecting edges
    `${line(110, 170, 180, 100)} ${line(250, 170, 310, 100)} ${line(250, 310, 310, 230)} ${line(110, 310, 180, 230)}`,
    // ground shadow guide
    'M 70 340 L 330 340',
  ],
};

const venn: Template = {
  id: 'overlapping-circles',
  name: 'Overlapping circles',
  category: 'shapes',
  viewBox: VB,
  paths: [circle(158, 162, 90), circle(242, 162, 90), circle(200, 236, 90)],
};

const polygons: Template = {
  id: 'stars-and-polygons',
  name: 'Stars and polygons',
  category: 'shapes',
  viewBox: VB,
  paths: [
    star(105, 108, 80, 32, 5),
    ngon(295, 105, 78, 6, 30),
    ngon(105, 300, 82, 3),
    `${star(295, 295, 80, 44, 8)} ${ngon(295, 295, 30, 8, 22.5)}`,
  ],
};

const spiralShape: Template = {
  id: 'spiral',
  name: 'Spiral',
  category: 'shapes',
  viewBox: VB,
  paths: [spiral(185, 200, 15, 11)],
};

export const shapes: Template[] = [cube, venn, polygons, spiralShape];
