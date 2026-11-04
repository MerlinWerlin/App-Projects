// Build-time POI collection only. Keep city requests small and sequential on the shared public service.
import { overpassQuery } from './pois.mjs';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const UA = 'SatchelMapPacks/1 (+https://github.com/MerlinWerlin/App-Projects)';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const brief = (value) => String(value).replace(/\s+/g, ' ').slice(0, 240);

export function cityCells(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) throw new Error('Invalid city bbox');
  const [w, s, e, n] = bbox;
  if (!(w >= -180 && e <= 180 && s >= -90 && n <= 90 && w < e && s < n)) throw new Error('Invalid city bbox');
  const x = (w + e) / 2;
  const y = (s + n) / 2;
  return [[w, s, x, y], [x, s, e, y], [w, y, x, n], [x, y, e, n]];
}

function retryDelay(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export async function fetchCityElements(bbox, {
  label = 'city', fetchImpl = fetch, sleep = pause, log = console.log, requestTimeoutMs = 90000,
} = {}) {
  const elements = new Map();
  const receipts = [];
  const cells = cityCells(bbox);
  for (const [index, cell] of cells.entries()) {
    if (index) await sleep(2000);
    const context = `${label} POIs cell ${index + 1}/${cells.length} [${cell.join(',')}]`;
    let complete = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let retryable = true;
      let wait = 30000 * attempt;
      try {
        const response = await fetchImpl(OVERPASS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: 'data=' + encodeURIComponent(overpassQuery(cell, 60)),
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (!response.ok) {
          retryable = response.status === 429 || response.status >= 500;
          wait = Math.max(wait, retryDelay(response.headers.get('retry-after')));
          throw new Error(`HTTP ${response.status}: ${brief(await response.text())}`);
        }
        const data = await response.json();
        // Overpass can return HTTP 200 with an error and partial elements. Never ship that as a complete city.
        if (data?.remark) throw new Error(`Overpass remark: ${brief(data.remark)}`);
        if (!data || !Array.isArray(data.elements)) throw new Error('Invalid Overpass response: missing elements array');
        for (const el of data.elements) {
          if (!el || !['node', 'way', 'relation'].includes(el.type) || !/^\d+$/.test(String(el.id))) {
            throw new Error('Invalid Overpass element identity');
          }
        }
        for (const el of data.elements) {
          const key = `${el.type}/${el.id}`;
          if (!elements.has(key)) elements.set(key, el);
        }
        receipts.push({ bbox: cell, attempt, elements: data.elements.length, endpoint: OVERPASS_URL,
          fetched: new Date().toISOString(), osmTimestamp: data.osm3s?.timestamp_osm_base ?? null });
        log(`${context}: ${data.elements.length} elements (attempt ${attempt})`);
        complete = true;
        break;
      } catch (error) {
        const message = `${context}, attempt ${attempt}/3: ${brief(error.message)}`;
        log(message);
        if (!retryable || attempt === 3 || wait > 300000) throw new Error(message, { cause: error });
        log(`Waiting ${wait / 1000}s before retry`);
        await sleep(wait);
      }
    }
    if (!complete) throw new Error(`${context}: incomplete`);
  }
  return { elements: [...elements.values()], receipts };
}
