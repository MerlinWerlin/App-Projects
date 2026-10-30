// T159: AWS Signature Version 4 (header auth) over node:crypto, for R2's S3-compatible API.
// No SDK. Tested against AWS's published S3 SigV4 examples in sigv4.test.mjs.
// Never logs anything; callers must not log the returned Authorization header either.

import { createHash, createHmac } from 'node:crypto';

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as SigV4 wants it (unreserved A-Z a-z 0-9 - _ . ~ kept). */
export function uriEncode(s, keepSlash = false) {
  let out = '';
  for (const byte of Buffer.from(String(s), 'utf8')) {
    const c = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.~]/.test(c) || (keepSlash && c === '/')) out += c;
    else out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

/** "20130524T000000Z" for a Date. */
export function amzDate(d) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function canonicalQuery(query) {
  const pairs = [];
  for (const [k, v] of Object.entries(query ?? {})) pairs.push([uriEncode(k), uriEncode(v ?? '')]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Sign a request. `path` is the raw (unencoded) path, e.g. "/bucket/art/x/v1/a.webp"; each segment
 * is URI-encoded once. `headers` must include host. Returns the headers to send (input headers +
 * x-amz-date + x-amz-content-sha256 + authorization), plus the intermediate strings for tests.
 */
export function signRequest({ method, path, query = {}, headers = {}, payloadHash = EMPTY_SHA256, region, service = 's3', accessKeyId, secretAccessKey, date = new Date() }) {
  const t = amzDate(date);
  const day = t.slice(0, 8);
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v);
  if (!h['x-amz-date']) h['x-amz-date'] = t;
  if (!h['x-amz-content-sha256']) h['x-amz-content-sha256'] = payloadHash;
  const names = Object.keys(h).sort();
  const canonicalHeaders = names.map((n) => `${n}:${h[n].trim().replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method.toUpperCase(), uriEncode(path, true), canonicalQuery(query), canonicalHeaders, signedHeaders, h['x-amz-content-sha256']].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', h['x-amz-date'], scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + secretAccessKey, day);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`;
  return { headers: { ...h, authorization }, canonicalRequest, stringToSign, signature, signedHeaders };
}
