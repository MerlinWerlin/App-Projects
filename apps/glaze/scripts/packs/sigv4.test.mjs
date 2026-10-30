// T159: SigV4 signer against AWS's published examples (Amazon S3 API reference, "Signature
// Calculations for the Authorization Header: Transferring Payload in a Single Chunk", example
// credentials AKIAIOSFODNN7EXAMPLE, bucket examplebucket, 24 May 2013, us-east-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_SHA256, signRequest, uriEncode } from './sigv4.mjs';

const creds = { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', service: 's3' };
const date = new Date(Date.UTC(2013, 4, 24, 0, 0, 0));
const host = 'examplebucket.s3.amazonaws.com';

test('AWS vector: GET Object with Range', () => {
  const r = signRequest({ ...creds, date, method: 'GET', path: '/test.txt', headers: { host, range: 'bytes=0-9' }, payloadHash: EMPTY_SHA256 });
  assert.equal(
    r.canonicalRequest,
    ['GET', '/test.txt', '', `host:${host}`, 'range:bytes=0-9', `x-amz-content-sha256:${EMPTY_SHA256}`, 'x-amz-date:20130524T000000Z', '', 'host;range;x-amz-content-sha256;x-amz-date', EMPTY_SHA256].join('\n'),
  );
  assert.equal(r.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.equal(
    r.headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  );
});

test('AWS vector: GET Bucket lifecycle (empty-valued query parameter)', () => {
  const r = signRequest({ ...creds, date, method: 'GET', path: '/', query: { lifecycle: '' }, headers: { host }, payloadHash: EMPTY_SHA256 });
  assert.equal(r.signature, 'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543');
});

test('AWS vector: GET Bucket list objects (sorted query)', () => {
  const r = signRequest({ ...creds, date, method: 'GET', path: '/', query: { prefix: 'J', 'max-keys': '2' }, headers: { host }, payloadHash: EMPTY_SHA256 });
  assert.equal(r.signature, '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
});

test('AWS vector: PUT Object (encoded key, extra headers)', () => {
  const payloadHash = '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072'; // sha256("Welcome to Amazon S3.")
  const r = signRequest({
    ...creds,
    date,
    method: 'PUT',
    path: '/test$file.text',
    headers: { host, date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
    payloadHash,
  });
  assert.equal(r.signature, '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
});

test('uriEncode keeps unreserved characters and slashes only when asked', () => {
  assert.equal(uriEncode('a b/c~d$'), 'a%20b%2Fc~d%24');
  assert.equal(uriEncode('/bucket/art/x/v1/a.b.webp', true), '/bucket/art/x/v1/a.b.webp');
});
