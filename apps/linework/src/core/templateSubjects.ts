// fb-1022b B1 (owner test 22 Oct 2026: "a whale is in Birds and insects"). Curated subjects per category: every
// template's id, name or tags must name at least one allowed subject of its category, and must not name a subject
// that belongs only to another category (a sea creature in Birds & insects, a bird in Sea life, …). Genre and style
// shelves (Cute, Heroes, Game world, Movie night, Fairy tales, Kids) may hold any subject, but still need one of
// their own genre words so a stray piece is caught. Pure TS; src/core/templateSubjects.test.ts runs it.
import type { Template, TemplateCategory } from './templates.ts';

const SEA = ['whale', 'dolphin', 'shark', 'octopus', 'squid', 'jellyfish', 'nautilus', 'seahorse', 'starfish', 'sea star', 'crab', 'lobster', 'shrimp', 'turtle', 'ray', 'manta', 'fish', 'koi', 'coral', 'shell', 'clam', 'oyster', 'urchin', 'seal', 'walrus', 'otter', 'orca', 'narwhal', 'eel', 'anemone', 'pufferfish', 'reef', 'kelp', 'sea', 'ocean', 'pond', 'puffin', 'penguin'];
const BIRDS_INSECTS = ['bird', 'songbird', 'owl', 'feather', 'swan', 'hummingbird', 'peacock', 'parrot', 'robin', 'sparrow', 'eagle', 'heron', 'crane', 'duck', 'hen', 'flamingo', 'ladybird', 'ladybug', 'butterfly', 'swallowtail', 'moth', 'dragonfly', 'bee', 'beetle', 'scarab', 'insect', 'ant', 'grasshopper', 'cricket', 'firefly', 'snail', 'spider', 'caterpillar'];
const LAND_ANIMALS = ['cat', 'kitten', 'dog', 'puppy', 'bunny', 'rabbit', 'hare', 'stag', 'deer', 'fox', 'bear', 'horse', 'pony', 'cow', 'pig', 'sheep', 'lamb', 'goat', 'mouse', 'hamster', 'squirrel', 'hedgehog', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'panda', 'koala', 'wolf', 'raccoon', 'badger', 'frog', 'lizard', 'tortoise', 'snail', 'pet', 'llama', 'sloth', 'kangaroo', 'wombat', 'camel', 'hippo', 'meerkat', 'rhino', 'moose', 'alpaca', 'bison'];

/** Allowed subject words per category (matched as whole words in id, name and tags, case-insensitive). */
export const CATEGORY_SUBJECTS: Readonly<Record<TemplateCategory, readonly string[]>> = {
  flowers: ['flower', 'tulip', 'daisy', 'rose', 'leaf', 'leaves', 'leafy', 'branch', 'sprig', 'sunflower', 'succulent', 'lavender', 'eucalyptus', 'monstera', 'dandelion', 'blossom', 'fern', 'bouquet', 'wreath', 'peony', 'ranunculus', 'herbarium', 'botanical', 'wildflower', 'posy', 'plant', 'lily', 'orchid', 'cactus', 'tree', 'vine', 'poppy', 'iris', 'lotus'],
  animals: LAND_ANIMALS,
  wildlife: BIRDS_INSECTS,
  sealife: SEA,
  faces: ['face', 'portrait', 'profile', 'girl', 'boy', 'eye', 'hand', 'figure', 'person', 'woman', 'man', 'lips', 'nose', 'ear', 'dancer', 'mannequin'],
  lettering: ['letters', 'lettering', 'alphabet', 'cursive', 'loop', 'banner', 'script', 'monogram', 'hello', 'thank', 'love', 'mr', 'birthday', 'christmas', 'word', 'calligraphy'],
  patterns: ['knot', 'tile', 'frame', 'snowflake', 'label', 'tag', 'scrollwork', 'corners', 'pattern', 'border', 'deco', 'damask', 'lace', 'paisley', 'tattoo', 'flash', 'anchor', 'banner', 'ribbon', 'rope', 'horseshoe'],
  mandalas: ['mandala', 'flower of life', 'compass', 'geometric', 'sacred', 'rosette'],
  places: ['house', 'window', 'mountain', 'lake', 'lighthouse', 'cottage', 'townhouse', 'townhouses', 'balloons', 'city', 'street', 'bridge', 'castle', 'village', 'landscape', 'beach', 'church', 'tower', 'barn', 'garden', 'windmill', 'treehouse', 'canal', 'cabin', 'hut', 'pier', 'harbour', 'quay', 'pagoda', 'desert', 'mesa', 'waterfall', 'hills', 'cafe', 'shop', 'shopfront', 'greenhouse', 'skyline', 'station', 'cliff'],
  fantasy: ['moon', 'stars', 'lantern', 'jack', 'castle', 'mushroom', 'potion', 'crystal', 'books', 'candle', 'dragon', 'gothic', 'witch', 'skull', 'spell', 'magic', 'halloween', 'wizard', 'cauldron', 'hourglass', 'rune', 'broom', 'mirror', 'enchanted', 'orb', 'celestial'],
  stilllife: ['gift', 'box', 'watch', 'key', 'teapot', 'teacup', 'cake', 'baubles', 'rings', 'vase', 'cup', 'bottle', 'fruit', 'jar', 'lamp', 'shoe', 'still life', 'candle', 'scissors', 'clock', 'books', 'kettle', 'camera', 'radio', 'typewriter', 'mug', 'pear', 'sneaker', 'brush', 'pot', 'glass', 'pan', 'stand', 'plant', 'mirror', 'candlestick', 'boot', 'handbag', 'bag', 'sunglasses', 'hat', 'headphones', 'record player', 'guitar', 'violin', 'book', 'sewing', 'spool', 'bicycle', 'umbrella', 'watering can', 'wheelbarrow', 'lantern', 'armchair', 'chair', 'grinder', 'pitcher', 'jug', 'spectacles', 'bread', 'bulb', 'record', 'toolbox', 'chess', 'fan', 'telephone', 'sewing machine'],
  cute: ['cute', 'kawaii', 'chibi', 'chubby', 'round', 'happy', 'smiling', 'sleepy', 'little', 'baby', 'tiny', 'sweet'],
  heroes: ['hero', 'heroes', 'shield', 'badge', 'mask', 'cape', 'caped', 'emblem', 'ninja', 'rescue', 'knight'],
  game: ['game', 'pixel', 'gamepad', 'monster', 'power-up', 'arcade', 'robot', 'racing', 'kart', 'mech', 'platform', 'level', 'controller', 'joystick'],
  movies: ['movie', 'film', 'cinema', 'space', 'astronaut', 'rocket', 'saucer', 'alien', 'planet', 'dinosaur', 't-rex', 'wizard', 'dragon', 'robot', 'pirate', 'treasure', 'popcorn', 'clapperboard', 'jungle', 'sci-fi', 'spaceship', 'ship', 'monster', 'detective', 'cowboy', 'sheriff', 'ghost', 'vampire', 'mummy', 'adventure', 'explorer', 'spy', 'superstar', 'western', 'noir', 'creature', 'captain', 'galaxy', 'cast'],
  fairytales: ['fairy', 'fairy-tale', 'fairytale', 'storybook', 'crown', 'wand', 'slipper', 'castle', 'unicorn', 'princess', 'prince', 'king', 'queen', 'frog', 'carriage', 'tower', 'mermaid', 'knight', 'coach', 'dragon', 'giant', 'witch', 'cottage', 'enchanted', 'forest', 'troll', 'gnome', 'elf', 'pixie', 'beanstalk', 'magic', 'spell', 'talking', 'once upon', 'cast'],
  kids: ['kids', 'little', 'friendly', 'smiling', 'baby', 'busy', 'abc', 'cute', 'happy', 'simple', 'toy', 'cartoon'],
  trade: ['trade', 'workshop', 'angle', 'mitre', 'bevel', 'protractor', 'square', 'circle', 'grid', 'weld', 'dovetail', 'joint', 'pipe', 'flange', 'layout', 'pitch', 'stringer', 'radius', 'polygon'],
  shapes: ['cube', 'circles', 'circle', 'stars', 'polygons', 'spiral', 'shape', 'triangle', 'square', 'sphere', 'cylinder', 'cone', 'pyramid', 'torus', 'prism', 'hexagon', 'perspective', 'isometric', 'polygon'],
};

/** Subjects that may only live in their own category among the subject shelves (not in the genre shelves list). */
export const EXCLUSIVE: Readonly<Partial<Record<TemplateCategory, readonly string[]>>> = {
  sealife: ['whale', 'dolphin', 'shark', 'octopus', 'squid', 'jellyfish', 'nautilus', 'seahorse', 'starfish', 'crab', 'lobster', 'coral', 'koi', 'fish', 'orca', 'narwhal', 'manta', 'eel', 'anemone', 'pufferfish'],
  wildlife: ['bird', 'songbird', 'owl', 'butterfly', 'moth', 'dragonfly', 'bee', 'beetle', 'ladybird', 'hummingbird', 'swan', 'parrot'],
};

/** Shelves bound to subjects: their pieces may not use another subject shelf's exclusive words. */
export const SUBJECT_SHELVES: readonly TemplateCategory[] = ['flowers', 'animals', 'wildlife', 'sealife', 'faces', 'lettering', 'patterns', 'mandalas', 'places', 'stilllife', 'shapes'];

function words(t: Template): string {
  return ` ${[t.id.replace(/-/g, ' '), t.name, ...(t.tags ?? [])].join(' ').toLowerCase().replace(/[^a-z0-9& -]+/g, ' ')} `;
}

function has(text: string, word: string): boolean {
  const w = word.toLowerCase().replace(/-/g, ' ');
  // whole word, allowing a plural 's'
  return text.includes(` ${w} `) || text.includes(` ${w}s `) || text.includes(` ${w}es `);
}

/** Problems with a template's category, or [] when it fits. */
export function categoryProblems(t: Template): string[] {
  const text = words(t);
  const out: string[] = [];
  const allowed = CATEGORY_SUBJECTS[t.category];
  if (!allowed.some((w) => has(text, w))) out.push(`${t.id}: names no allowed subject of '${t.category}'`);
  if (SUBJECT_SHELVES.includes(t.category)) {
    for (const [cat, list] of Object.entries(EXCLUSIVE)) {
      if (cat === t.category) continue;
      const hit = (list ?? []).find((w) => has(text, w));
      if (hit) out.push(`${t.id}: '${hit}' belongs in '${cat}', not '${t.category}'`);
    }
  }
  return out;
}
