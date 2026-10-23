// Faces: simple generic original drawings on a 400×400 canvas.
import type { Template } from '../templates.ts';
import { circle, ellipse, mirrorX } from './draw.ts';

const VB = '0 0 400 400';

const eyeL = 'M 145 182 C 155 170 175 170 185 182 C 175 192 155 192 145 182 Z';
const browL = 'M 140 158 C 154 148 174 148 188 156';
const earL = 'M 92 190 C 70 178 68 232 94 236';

const smiling: Template = {
  id: 'smiling-face',
  name: 'Smiling face',
  category: 'faces',
  viewBox: VB,
  paths: [
    ellipse(200, 205, 108, 132),
    `${earL} ${mirrorX(earL, 200)}`,
    // hair
    'M 94 178 C 96 92 160 60 220 72 C 272 82 306 122 306 178',
    'M 112 130 C 150 146 202 134 232 96 M 232 96 C 248 118 272 128 296 132',
    // eyes and brows
    `${eyeL} ${mirrorX(eyeL, 200)} ${circle(165, 181, 6)} ${circle(235, 181, 6)}`,
    `${browL} ${mirrorX(browL, 200)}`,
    // nose and smile
    'M 200 192 C 196 214 190 230 200 236 C 206 238 210 234 213 230',
    'M 158 266 C 180 292 220 292 242 266 M 152 262 L 160 270 M 248 262 L 240 270',
    // neck
    'M 166 330 L 164 382 M 234 330 L 236 382',
  ],
};

const profile: Template = {
  id: 'profile-face',
  name: 'Face in profile',
  category: 'faces',
  viewBox: VB,
  paths: [
    // forehead, nose, lips, chin, throat
    'M 232 50 C 160 50 122 92 116 150 C 114 168 112 178 106 192 L 88 226 C 86 234 94 238 108 238 C 106 246 110 252 116 256 C 108 260 108 266 117 270 C 112 282 116 296 128 302 C 148 312 176 310 196 300 C 194 324 190 348 186 376',
    // back of head and neck
    'M 232 50 C 302 50 334 112 322 182 C 316 222 292 250 282 282 C 276 312 280 342 292 376',
    // ear
    'M 240 170 C 260 158 278 184 268 206 C 260 222 246 222 240 210 M 248 180 C 258 178 264 192 256 200',
    // eye and brow
    'M 140 178 C 148 172 158 172 166 180 M 140 178 C 148 186 158 186 166 180',
    'M 128 160 C 144 150 160 150 174 158',
    // hairline and hair strands
    'M 118 112 C 178 90 240 110 252 162 M 150 72 C 200 66 250 84 280 120 M 190 54 C 240 58 280 84 300 130',
    // mouth corner
    'M 116 263 L 128 263',
  ],
};

const girl: Template = {
  id: 'girl-with-bun',
  name: 'Girl with a bun',
  category: 'faces',
  viewBox: VB,
  paths: [
    circle(200, 210, 100),
    // bun and hair tie
    'M 172 113 C 150 100 155 52 200 48 C 245 52 250 100 228 113',
    'M 172 113 C 188 124 212 124 228 113',
    // hair cap and fringe
    'M 102 196 C 100 140 146 112 200 112 C 254 112 300 140 298 196',
    'M 108 170 C 150 178 192 162 212 116 M 212 116 C 232 150 262 168 294 170',
    // eyes with highlights, cheeks, smile
    `${circle(165, 218, 12)} ${circle(235, 218, 12)} ${circle(169, 213, 3)} ${circle(239, 213, 3)}`,
    `${ellipse(140, 250, 14, 9)} ${ellipse(260, 250, 14, 9)}`,
    'M 180 260 C 190 274 210 274 220 260',
    // neck and shoulders
    'M 180 308 L 180 330 C 140 335 110 355 100 382 M 220 308 L 220 330 C 260 335 290 355 300 382',
  ],
};

const boy: Template = {
  id: 'boy-with-cap',
  name: 'Boy with a cap',
  category: 'faces',
  viewBox: VB,
  paths: [
    // face outline below the cap
    'M 107 196 C 100 270 140 318 200 318 C 260 318 300 270 293 196',
    // cap dome, seam, button
    'M 107 196 C 110 126 155 96 200 96 C 245 96 290 126 293 196 Z',
    'M 200 102 C 190 140 190 170 196 196',
    circle(200, 96, 6),
    // brim
    'M 107 196 C 140 232 260 232 293 196 M 120 205 C 112 214 115 222 130 222 C 170 236 230 236 270 222 C 285 222 288 214 280 205',
    // ears
    'M 105 232 C 86 226 86 262 108 266 M 295 232 C 314 226 314 262 292 266',
    // eyes, brows, nose, open grin
    `${circle(168, 252, 8)} ${circle(232, 252, 8)}`,
    'M 155 238 L 180 236 M 220 236 L 245 238',
    'M 200 260 C 194 272 204 278 210 270',
    'M 168 284 L 232 284 C 224 304 176 304 168 284 Z',
    // neck and collar
    'M 182 316 L 182 332 C 142 337 112 357 102 382 M 218 316 L 218 332 C 258 337 288 357 298 382',
    'M 182 332 L 200 352 L 218 332',
  ],
};

export const faces: Template[] = [smiling, profile, girl, boy];
