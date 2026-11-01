// The POI half of the city-pack build (tools/maps/build.mjs), kept pure so `npm test` can check it offline with a
// fixture (src/core/mappack.test.ts): the Overpass query for a city bbox and the shaping of the Overpass answer into
// pois.json. No network, no file system, no npm dependency here. Contract: docs/MAP_PACKS.md, read by the app in
// src/core/toilets.ts (toilets) and src/core/help.ts (hospitals/clinics, pharmacies, police).
//
// pois.json format history (POIS_FORMAT, also written to meta.json and the catalog entry as `format`):
//   1 (no `format` field): toilets + places { id, lat, lon, category, name? }; no police, no phone, no hours.
//   2: adds `police` places, and for the help categories (hospital_clinic, pharmacy, police) the OSM `amenity`,
//      `phone` (phone or contact:phone), `opening_hours` and `emergency` (hospitals); access=private/no help places
//      are left out. Old app builds ignore the new fields, and new builds still read format 1 packs.
//   T13 (still format 2, additive): `places[].category` may also be `food` (restaurant / cafe / fast food),
//      `supermarket` and `embassy` (amenity=embassy or office=diplomatic), for the Map tab's offline POI layer
//      (src/core/packpois.ts). Older app builds skip categories they do not know, so no format bump is needed.
//   T156 (still format 2, additive): `places[].category` may also be `lift` (highway=elevator), and every place keeps
//      the OSM `wheelchair` tag (yes / limited / no / designated) when it has one, for step-free travel
//      (src/core/stepfree.ts). Older app builds ignore both.

export const POIS_FORMAT = 2;
export const POIS_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

/** pois.json `places[].category` -> the OSM tags that put a feature in it (first match wins, in this order). */
export const POI_TAGS = {
  drinking_water: [['amenity', 'drinking_water']],
  fuel: [['amenity', 'fuel']],
  pharmacy: [['amenity', 'pharmacy']],
  hospital_clinic: [['amenity', 'hospital'], ['amenity', 'clinic']],
  police: [['amenity', 'police']],
  atm_bank: [['amenity', 'atm'], ['amenity', 'bank']],
  transport: [['railway', 'station'], ['amenity', 'bus_station'], ['amenity', 'ferry_terminal']],
  // T13: added after the first categories so their matches never change.
  food: [['amenity', 'restaurant'], ['amenity', 'cafe'], ['amenity', 'fast_food']],
  supermarket: [['shop', 'supermarket']],
  embassy: [['amenity', 'embassy'], ['office', 'diplomatic']],
  // T156: lifts, added last so no earlier match changes.
  lift: [['highway', 'elevator']],
};

/** The categories Nearest help reads (src/core/help.ts); these get the contact details. */
export const HELP_POI_CATEGORIES = ['hospital_clinic', 'pharmacy', 'police'];

export const TOILET_KEYS = ['name', 'fee', 'wheelchair', 'changing_table', 'opening_hours', 'access', 'unisex', 'operator'];

const HIDDEN_ACCESS = new Set(['private', 'no']);
const MAX_TAG = 255; // OSM's own value limit; anything longer is junk

const tag = (tags, k) => {
  const v = tags[k];
  return typeof v === 'string' && v.trim() && v.length <= MAX_TAG ? v.trim() : undefined;
};

/** Overpass QL for toilets and every POI_TAGS feature inside bbox [west, south, east, north], with centres. */
export function overpassQuery(bbox) {
  const [w, s, e, n] = bbox;
  const b = `${s},${w},${n},${e}`;
  const parts = [`nwr["amenity"="toilets"](${b});`];
  for (const tags of Object.values(POI_TAGS)) for (const [k, v] of tags) parts.push(`nwr["${k}"="${v}"](${b});`);
  return `[out:json][timeout:120];(${parts.join('')});out center tags;`;
}

/** The help details for a place in one of HELP_POI_CATEGORIES (only the tags that are present). */
function helpDetails(tags) {
  const out = {};
  const amenity = tag(tags, 'amenity');
  if (amenity) out.amenity = amenity;
  const phone = tag(tags, 'phone') ?? tag(tags, 'contact:phone');
  if (phone) out.phone = phone;
  const hours = tag(tags, 'opening_hours');
  if (hours) out.opening_hours = hours;
  if (amenity === 'hospital' && tag(tags, 'emergency')) out.emergency = tag(tags, 'emergency');
  return out;
}

/**
 * Overpass `elements` -> pois.json. Nodes carry lat/lon, ways and relations `center`; ids are the OSM type letter
 * plus the id, deduped. Private toilets and private help places are dropped. English names are preferred for places.
 */
export function toPois(elements, built) {
  const toilets = [];
  const places = [];
  const seen = new Set();
  for (const el of Array.isArray(elements) ? elements : []) {
    if (!el || typeof el !== 'object' || typeof el.type !== 'string') continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags && typeof el.tags === 'object' ? el.tags : {};
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = el.type[0] + el.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const ll = { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
    if (tags.amenity === 'toilets') {
      if (HIDDEN_ACCESS.has(tags.access)) continue;
      const t = { id, ...ll };
      for (const k of TOILET_KEYS) if (tags[k]) t[k] = tags[k];
      if (!t.changing_table && tags.diaper) t.changing_table = tags.diaper === 'no' ? 'no' : 'yes';
      toilets.push(t);
      continue;
    }
    const cat = Object.entries(POI_TAGS).find(([, list]) => list.some(([k, v]) => tags[k] === v));
    if (!cat) continue;
    const help = HELP_POI_CATEGORIES.includes(cat[0]);
    if (help && HIDDEN_ACCESS.has(tags.access)) continue;
    const name = tag(tags, 'name:en') ?? tag(tags, 'name');
    const wheelchair = tag(tags, 'wheelchair');
    places.push({ id, ...ll, category: cat[0], ...(name ? { name } : {}), ...(help ? helpDetails(tags) : {}), ...(wheelchair ? { wheelchair } : {}) });
  }
  return { format: POIS_FORMAT, built, attribution: POIS_ATTRIBUTION, toilets, places };
}
