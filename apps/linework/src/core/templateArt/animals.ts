// Animals: original line art on a 400×400 canvas.
import type { Template } from '../templates.ts';
import { circle, ellipse, line, spiral } from './draw.ts';

const VB = '0 0 400 400';

const cat: Template = {
  id: 'cat-sitting',
  name: 'Sitting cat',
  category: 'animals',
  viewBox: VB,
  paths: [
    // head with ears
    'M 150 115 L 152 58 L 185 82 C 195 79 205 79 215 82 L 248 58 L 250 115 C 262 135 258 170 235 186 C 215 198 185 198 165 186 C 142 170 138 135 150 115 Z',
    // inner ears
    'M 160 100 L 161 75 L 178 88 M 240 100 L 239 75 L 222 88',
    // eyes, nose, mouth
    `${ellipse(178, 130, 7, 10)} ${ellipse(222, 130, 7, 10)}`,
    'M 193 150 L 207 150 L 200 158 Z M 200 158 C 200 166 190 169 186 164 M 200 158 C 200 166 210 169 214 164',
    // whiskers
    `${line(170, 154, 126, 146)} ${line(170, 160, 124, 164)} ${line(230, 154, 274, 146)} ${line(230, 160, 276, 164)}`,
    // body
    'M 168 192 C 140 220 125 280 130 330 C 132 350 150 360 175 360 L 225 360 C 250 360 268 350 270 330 C 275 280 260 220 232 192',
    // front legs and paws
    'M 182 270 C 178 305 178 335 180 360 M 218 270 C 222 305 222 335 220 360',
    'M 180 360 C 172 352 160 352 158 360 M 220 360 C 228 352 240 352 242 360',
    // tail
    'M 268 340 C 310 348 345 322 334 285 C 326 258 300 262 304 282',
  ],
};

const fish: Template = {
  id: 'fish',
  name: 'Fish',
  category: 'sealife',
  viewBox: VB,
  paths: [
    // body and tail
    'M 70 200 C 120 120 240 112 300 200 C 240 288 120 280 70 200 Z',
    'M 300 200 L 362 145 C 350 180 350 220 362 255 Z',
    // eye, gill, mouth
    `${circle(115, 188, 10)} ${circle(115, 188, 3)}`,
    'M 148 150 C 168 180 168 222 148 252',
    'M 70 200 L 88 206',
    // fins
    'M 170 137 C 190 95 240 100 256 152',
    'M 190 270 C 200 300 232 302 242 256',
    // scales
    'M 190 172 C 205 182 205 202 190 212 M 220 165 C 235 178 235 202 220 214 M 250 170 C 263 182 263 202 250 214 M 205 212 C 220 222 220 242 205 250 M 235 214 C 248 224 248 240 235 248',
    // bubbles
    `${circle(48, 140, 6)} ${circle(38, 108, 9)} ${circle(56, 76, 5)}`,
  ],
};

const owl: Template = {
  id: 'owl',
  name: 'Owl',
  category: 'wildlife',
  viewBox: VB,
  paths: [
    // body
    'M 200 60 C 270 60 310 130 310 220 C 310 300 265 345 200 345 C 135 345 90 300 90 220 C 90 130 130 60 200 60 Z',
    // ear tufts
    'M 125 105 L 115 52 L 160 80 M 275 105 L 285 52 L 240 80',
    // eyes
    `${circle(160, 160, 35)} ${circle(240, 160, 35)} ${circle(162, 162, 12)} ${circle(238, 162, 12)}`,
    // beak
    'M 190 186 L 210 186 L 200 210 Z',
    // wings
    'M 102 200 C 132 222 147 270 137 322 M 298 200 C 268 222 253 270 263 322',
    // chest feathers
    'M 170 240 C 175 252 185 252 190 240 M 210 240 C 215 252 225 252 230 240 M 150 268 C 155 280 165 280 170 268 M 190 268 C 195 280 205 280 210 268 M 230 268 C 235 280 245 280 250 268 M 170 296 C 175 308 185 308 190 296 M 210 296 C 215 308 225 308 230 296',
    // feet
    'M 172 342 L 166 362 M 182 345 L 182 364 M 192 342 L 198 362 M 208 342 L 202 362 M 218 345 L 218 364 M 228 342 L 234 362',
    // branch
    'M 50 366 C 150 358 250 374 350 362 M 300 364 C 315 375 330 380 345 378',
  ],
};

const snail: Template = {
  id: 'snail',
  name: 'Snail',
  category: 'animals',
  viewBox: VB,
  paths: [
    // body and head
    'M 62 316 C 120 300 250 298 296 292 C 316 258 324 224 340 210 C 358 198 372 214 364 238 C 356 272 350 306 330 318 C 290 334 140 334 62 316 Z',
    // antennae
    `M 352 206 L 364 160 M 340 208 L 330 164 ${circle(365, 154, 6)} ${circle(329, 158, 6)}`,
    // eye and smile
    `${circle(350, 226, 3)} M 344 248 C 350 254 357 252 360 245`,
    // shell spiral (outer radius 90, sits on the body)
    spiral(190, 205, 15, 6),
    // shell rim closing over the top
    'M 100 205 A 90 90 0 0 1 280 205',
  ],
};

export const animals: Template[] = [cat, fish, owl, snail];
