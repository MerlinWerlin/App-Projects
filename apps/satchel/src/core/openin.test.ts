// T14 Open in / Copy to Satchel: incoming-file router (kind, route, redirect) and .eml / text extraction.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

type OpenInFilter = { action: string; category: string[]; data: { mimeType?: string; scheme?: string }[] };
const OPEN_IN_FILTER = JSON.parse(readFileSync(new URL('../../plugins/open-in-filter.json', import.meta.url), 'utf8')) as OpenInFilter;
import {
  base64ToBytes,
  classifyFile,
  decideKind,
  decodeHeader,
  decodeQuotedPrintable,
  emlToPasteText,
  fileNameFromUrl,
  htmlToText,
  incomingName,
  incomingRedirect,
  isIncomingFileUrl,
  MAX_PASTE_CHARS,
  mimeForKind,
  parseEml,
  pasteTextFor,
  routeFor,
  sniffKind,
  decodeBytes,
} from './openin.ts';
import { parseBookings } from './pasteparse.ts';

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

test('file and content URLs are incoming files; app links and web links are not', () => {
  assert.equal(isIncomingFileUrl('file:///private/var/mobile/Containers/Data/Application/X/Documents/Inbox/ticket.pdf'), true);
  assert.equal(isIncomingFileUrl('content://com.android.providers.downloads.documents/document/42'), true);
  assert.equal(isIncomingFileUrl('FILE:///a.pdf'), true);
  for (const u of ['satchel://trip/1', 'https://example.com/a.pdf', '/trip/1', '', null, undefined, 42]) assert.equal(isIncomingFileUrl(u), false, String(u));
});

test('file name comes from the decoded last path segment', () => {
  assert.equal(fileNameFromUrl('file:///var/Inbox/Booking%20confirmation%20(2).pdf'), 'Booking confirmation (2).pdf');
  assert.equal(fileNameFromUrl('file:///var/Inbox/trip.satchel?x=1#y'), 'trip.satchel');
  assert.equal(fileNameFromUrl('content://downloads/document/42'), '42');
  assert.equal(fileNameFromUrl('file:///var/Inbox/bad%E0%A4%A.pdf'), 'bad%E0%A4%A.pdf');
});

test('kind by extension, UTI and MIME type', () => {
  assert.equal(classifyFile({ name: 'Tokyo.satchel' }), 'trip');
  assert.equal(classifyFile({ name: 'eticket.PDF' }), 'pdf');
  for (const n of ['a.jpg', 'a.jpeg', 'a.png', 'a.HEIC', 'a.heif', 'a.gif', 'a.webp']) assert.equal(classifyFile({ name: n }), 'image', n);
  assert.equal(classifyFile({ name: 'notes.txt' }), 'text');
  assert.equal(classifyFile({ name: 'Your booking.eml' }), 'eml');
  assert.equal(classifyFile({ name: 'x', uti: 'com.adobe.pdf' }), 'pdf');
  assert.equal(classifyFile({ name: 'x', uti: 'public.email-message' }), 'eml');
  assert.equal(classifyFile({ name: 'x', uti: 'com.apple.mail.email' }), 'eml');
  assert.equal(classifyFile({ name: 'x', uti: 'app.satchel.trip' }), 'trip');
  assert.equal(classifyFile({ name: 'x', mime: 'message/rfc822' }), 'eml');
  assert.equal(classifyFile({ name: 'x', mime: 'image/png' }), 'image');
  assert.equal(classifyFile({ name: 'x', mime: 'text/plain; charset=utf-8' }), 'text');
  assert.equal(classifyFile({ name: 'x', mime: 'application/pdf' }), 'pdf');
  assert.equal(classifyFile({ name: 'song.mp3', mime: 'audio/mpeg' }), 'unknown');
  assert.equal(classifyFile({ name: 'sheet.xlsx' }), 'unknown');
  assert.equal(classifyFile({}), 'unknown');
});

test('sniffing the first bytes', () => {
  assert.equal(sniffKind(bytes('%PDF-1.7\n')), 'pdf');
  assert.equal(sniffKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image');
  assert.equal(sniffKind(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), 'image');
  assert.equal(sniffKind(bytes('GIF89a')), 'image');
  assert.equal(sniffKind(bytes('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')), 'image');
  assert.equal(sniffKind(bytes('\u0000\u0000\u0000\u0018ftypheic')), 'image');
  assert.equal(sniffKind(bytes('{"format":"satchel-trip","version":1,"trip":{}}')), 'trip');
  assert.equal(sniffKind(bytes('{"name":"something else"}')), 'unknown');
  assert.equal(sniffKind(bytes('Received: from mx\r\nSubject: Booking\r\n')), 'eml');
  assert.equal(sniffKind(bytes('MIME-Version: 1.0\nFrom: a@b.c\n')), 'eml');
  assert.equal(sniffKind(bytes('Flight QF25 departs 21:00')), 'text');
  assert.equal(sniffKind(Uint8Array.from([0xef, 0xbb, 0xbf, 0x48, 0x69])), 'text');
  assert.equal(sniffKind(bytes('PK\u0003\u0004zip')), null);
  assert.equal(sniffKind(new Uint8Array(0)), null);
});

test('decideKind: names win, then the bytes; a nameless or .json file is only a trip if it says so', () => {
  assert.equal(decideKind({ name: 'a.pdf' }, bytes('not a pdf')), 'pdf');
  assert.equal(decideKind({ name: '42' }, bytes('%PDF-1.4')), 'pdf');
  assert.equal(decideKind({ name: 'trip.json' }, bytes('{"format": "satchel-trip"}')), 'trip');
  assert.equal(decideKind({ name: 'other.json' }, bytes('{"a":1}')), 'unknown');
  assert.equal(decideKind({ name: 'mail.txt' }, bytes('From: x@y.z\nSubject: Hi\n')), 'eml');
  assert.equal(decideKind({ name: 'note.txt' }, bytes('Hotel check-in 15:00')), 'text');
  assert.equal(decideKind({ name: 'note.txt' }, null), 'text');
  assert.equal(decideKind({ name: 'archive.zip' }, bytes('PK\u0003\u0004')), 'unknown');
  assert.equal(decideKind({ name: 'x' }, null), 'unknown');
});

test('every kind has a route; unknown is kept honest', () => {
  assert.equal(routeFor('trip'), 'import');
  assert.equal(routeFor('pdf'), 'addToTrip');
  assert.equal(routeFor('image'), 'addToTrip');
  assert.equal(routeFor('text'), 'paste');
  assert.equal(routeFor('eml'), 'paste');
  assert.equal(routeFor('unknown'), 'unsupported');
});

test('incomingRedirect sends file URLs to the Open in screen and leaves everything else alone', () => {
  const url = 'file:///var/Inbox/My ticket.pdf';
  const r = incomingRedirect(url);
  assert.ok(r);
  assert.match(r, /^\/openin\?uri=/);
  assert.equal(decodeURIComponent(r.slice('/openin?uri='.length)), url);
  assert.equal(incomingRedirect('satchel://trip/1'), null);
  assert.equal(incomingRedirect('/trip/abc'), null);
  assert.equal(incomingRedirect(undefined), null);
  assert.equal(incomingRedirect({}), null);
});

test('the +native-intent hook and the not-found fallback use incomingRedirect and never throw', () => {
  const intent = readFileSync(new URL('../../app/+native-intent.tsx', import.meta.url), 'utf8');
  assert.match(intent, /export function redirectSystemPath/);
  assert.match(intent, /incomingRedirect/);
  assert.match(intent, /catch/);
  const notFound = readFileSync(new URL('../../app/+not-found.tsx', import.meta.url), 'utf8');
  assert.match(notFound, /incomingRedirect/);
});

test('inbox names are safe and attachment MIME types are right', () => {
  assert.equal(incomingName('in1', 'Booking (2).pdf', 'pdf'), 'in1-Booking_2_.pdf');
  assert.equal(incomingName('in1', '../../etc', 'pdf'), 'in1-_.._etc');
  assert.equal(incomingName('in1', '', 'image'), 'in1-image.jpg');
  assert.equal(incomingName('in1', '', 'unknown'), 'in1-file');
  assert.ok(incomingName('in1', 'a'.repeat(200)).length <= 84);
  assert.equal(mimeForKind('pdf', 'x', 'application/octet-stream'), 'application/pdf');
  assert.equal(mimeForKind('image', 'x.png', ''), 'image/png');
  assert.equal(mimeForKind('image', 'x', 'image/heic'), 'image/heic');
  assert.equal(mimeForKind('image', 'x', null), 'image/jpeg');
});

test('base64, quoted-printable, charsets and encoded headers', () => {
  assert.equal(decodeBytes(base64ToBytes(b64('Kyōto ✈ 東京'))), 'Kyōto ✈ 東京');
  assert.equal(decodeBytes(base64ToBytes('SGVs\r\nbG8=')), 'Hello');
  assert.equal(decodeBytes(base64ToBytes('SGk')), 'Hi');
  assert.equal(decodeBytes(decodeQuotedPrintable('Caf=C3=A9 =\r\nau lait =3D yes')), 'Café au lait = yes');
  assert.equal(decodeBytes(decodeQuotedPrintable('Caf=E9'), 'iso-8859-1'), 'Café');
  assert.equal(decodeBytes(Uint8Array.from([0xff, 0x41])), '�A');
  assert.equal(decodeHeader('=?UTF-8?B?' + b64('Your trip to Kyōto') + '?='), 'Your trip to Kyōto');
  assert.equal(decodeHeader('=?utf-8?Q?Booking_confirmed_=E2=9C=88?= QF25'), 'Booking confirmed ✈ QF25');
  assert.equal(decodeHeader('=?UTF-8?Q?a?= =?UTF-8?Q?b?='), 'ab');
  assert.equal(decodeHeader('Plain subject'), 'Plain subject');
});

test('htmlToText keeps the words and line breaks, drops tags, styles and scripts', () => {
  const html = '<html><head><style>p{color:red}</style><title>t</title></head><body><h1>Booking&nbsp;confirmed</h1><p>Flight QF25<br>Sydney &rarr; Tokyo</p><table><tr><td>Ref</td><td>ABC123</td></tr></table><script>x()</script><p>&#169; &#x2708; &amp; &bogus;</p></body></html>';
  assert.equal(htmlToText(html), 'Booking confirmed\nFlight QF25\nSydney → Tokyo\nRef ABC123\n© ✈ & &bogus;');
});

const SIMPLE = [
  'Return-Path: <noreply@airline.example>',
  'From: "Example Air" <noreply@airline.example>',
  'To: jared@example.com',
  'Subject: =?UTF-8?Q?Your_booking_=E2=80=93_QF25?=',
  'Date: Fri, 12 Mar 2027 09:00:00 +1100',
  'Content-Type: text/plain; charset="utf-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Flight QF25 Sydney to Tokyo=0A12 Mar 2027 21:00',
  'Booking reference: ABC123',
].join('\r\n');

test('parseEml: a single-part quoted-printable message', () => {
  const m = parseEml(SIMPLE);
  assert.equal(m.subject, 'Your booking – QF25');
  assert.equal(m.from, '"Example Air" <noreply@airline.example>');
  assert.equal(m.date, 'Fri, 12 Mar 2027 09:00:00 +1100');
  assert.equal(m.body, 'Flight QF25 Sydney to Tokyo\n12 Mar 2027 21:00\nBooking reference: ABC123');
});

const MULTI = [
  'From: Hotel <stay@hotel.example>',
  'Subject: Reservation',
  '  confirmed',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="outer"',
  '',
  'This is a multi-part message.',
  '--outer',
  'Content-Type: multipart/alternative; boundary=inner',
  '',
  '--inner',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  b64('Hotel Kyōto Garden\nCheck-in 15 Mar 2027 15:00\nConfirmation 998877'),
  '--inner',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>HTML version</p>',
  '--inner--',
  '--outer',
  'Content-Type: application/pdf; name="voucher.pdf"',
  'Content-Disposition: attachment; filename="voucher.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--outer--',
  '',
].join('\n');

test('parseEml: nested multipart picks text/plain (base64) and skips attachments; folded headers join', () => {
  const m = parseEml(MULTI);
  assert.equal(m.subject, 'Reservation confirmed');
  assert.equal(m.body, 'Hotel Kyōto Garden\nCheck-in 15 Mar 2027 15:00\nConfirmation 998877');
});

test('parseEml: only text/html becomes readable text', () => {
  const raw = ['Subject: Car hire', 'Content-Type: text/html; charset=iso-8859-1', 'Content-Transfer-Encoding: quoted-printable', '', '<div>Pick-up M=FCnchen</div><div>Ref&nbsp;XY12</div>'].join('\n');
  assert.equal(parseEml(raw).body, 'Pick-up München\nRef XY12');
});

test('parseEml: a message with no body and odd input never throws', () => {
  assert.deepEqual(parseEml('Subject: Only a subject'), { subject: 'Only a subject', from: '', date: '', body: '' });
  assert.deepEqual(parseEml(''), { subject: '', from: '', date: '', body: '' });
  const broken = 'Content-Type: multipart/mixed; boundary=b\n\n--b\nContent-Type: text/plain\n\nhello';
  assert.equal(parseEml(broken).body, 'hello');
});

test('emlToPasteText puts Subject / From / Date first, then the body, capped', () => {
  const text = emlToPasteText(SIMPLE);
  assert.ok(text.startsWith('Subject: Your booking – QF25\nFrom: "Example Air" <noreply@airline.example>\nDate: Fri, 12 Mar 2027'));
  assert.match(text, /\n\nFlight QF25 Sydney to Tokyo/);
  const huge = `Subject: x\n\n${'a'.repeat(MAX_PASTE_CHARS * 2)}`;
  assert.equal(emlToPasteText(huge).length, MAX_PASTE_CHARS);
});

test('pasteTextFor tidies plain text and the paste parser finds the booking in an incoming email', () => {
  assert.equal(pasteTextFor('text', '﻿Line one\r\nLine two\r\n'), 'Line one\nLine two');
  const text = pasteTextFor('eml', SIMPLE);
  const found = parseBookings(text, { now: '2027-01-01', us: false, fallbackTz: 'Australia/Sydney' });
  assert.ok(found.length >= 1, 'a booking is found');
  assert.ok(found.some((b) => b.kind === 'flight'), 'it is a flight');
});

test('app.json declares the document types, the exported trip UTI and Android VIEW filters', () => {
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
    expo: { ios: { infoPlist: Record<string, unknown> }; android: { intentFilters?: { action: string; data: { mimeType?: string; scheme?: string }[] }[] } };
  };
  const plist = app.expo.ios.infoPlist;
  const types = (plist.CFBundleDocumentTypes as { LSItemContentTypes: string[] }[]).flatMap((d) => d.LSItemContentTypes);
  for (const u of ['app.satchel.trip', 'com.adobe.pdf', 'public.image', 'public.plain-text', 'com.apple.mail.email', 'public.email-message']) assert.ok(types.includes(u), u);
  for (const u of types) assert.notEqual(classifyFile({ uti: u }), 'unknown', `${u} is routed`);
  const exported = (plist.UTExportedTypeDeclarations as { UTTypeIdentifier: string; UTTypeConformsTo: string[]; UTTypeTagSpecification: Record<string, string[]> }[])[0];
  assert.equal(exported.UTTypeIdentifier, 'app.satchel.trip');
  assert.deepEqual(exported.UTTypeConformsTo, ['public.json', 'public.data']);
  assert.deepEqual(exported.UTTypeTagSpecification['public.filename-extension'], ['satchel']);
  assert.equal(plist.LSSupportsOpeningDocumentsInPlace, false);
  const filters = [OPEN_IN_FILTER];
  const mimes = filters.filter((f) => f.action === 'VIEW').flatMap((f) => f.data.map((d) => d.mimeType));
  for (const m of ['application/pdf', 'image/*', 'text/plain', 'message/rfc822', 'application/json']) assert.ok(mimes.includes(m), m);
});

// T155: Android opens Satchel's own trip and backup files by MIME type too (the same VIEW filter), and each routes.
test('app.json Android VIEW filter carries the trip and backup MIME types', async () => {
  const { BACKUP_FILE_MIME } = await import('./backup.ts');
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
    expo: { ios: { infoPlist: { UTExportedTypeDeclarations: { UTTypeTagSpecification: Record<string, string[]> }[] } }; android: { intentFilters: { action: string; category: string[]; data: { mimeType?: string }[] }[] } };
  };
  const view = [OPEN_IN_FILTER].filter((f) => f.action === 'VIEW');
  const mimes = view.flatMap((f) => f.data.map((d) => d.mimeType)).filter(Boolean);
  // the same MIME types the iOS exported types declare
  const exported = app.expo.ios.infoPlist.UTExportedTypeDeclarations.flatMap((u) => u.UTTypeTagSpecification['public.mime-type'] ?? []);
  assert.ok(exported.includes(BACKUP_FILE_MIME));
  for (const m of exported) assert.ok(mimes.includes(m), m);
  assert.equal(classifyFile({ name: '', mime: BACKUP_FILE_MIME }), 'backup');
  assert.equal(classifyFile({ name: '', mime: 'application/vnd.satchel.trip+json' }), 'trip');
  assert.ok(view.every((f) => f.category.includes('DEFAULT')));
});

// T154: a .satchelbackup opened in Satchel goes to the restore preview, never to the trip import.
test('a .satchelbackup is a backup by name, UTI, MIME type or contents, and routes to restore', async () => {
  const { BACKUP_UTI, BACKUP_FILE_MIME, BACKUP_EXT } = await import('./backup.ts');
  const { maxIncomingBytes, MAX_INCOMING_BYTES, MAX_INCOMING_BACKUP_BYTES } = await import('./openin.ts');
  assert.equal(BACKUP_UTI, 'app.satchel.backup');
  assert.equal(classifyFile({ name: `Satchel backup 2026-11-01${BACKUP_EXT}` }), 'backup');
  assert.equal(classifyFile({ name: 'x', uti: BACKUP_UTI }), 'backup');
  assert.equal(classifyFile({ name: 'x', mime: BACKUP_FILE_MIME }), 'backup');
  assert.equal(routeFor('backup'), 'restore');
  assert.equal(routeFor('trip'), 'import');
  const head = new TextEncoder().encode('{"format":"satchel-backup","version":1,"app":"0.1.0"');
  assert.equal(decideKind({ name: 'backup.json' }, head), 'backup', 'a renamed .json backup is still a backup');
  assert.equal(decideKind({ name: 'backup.txt' }, head), 'backup');
  assert.equal(decideKind({ name: '' }, head), 'backup', 'nameless content:// file');
  assert.equal(decideKind({ name: 'trip.json' }, new TextEncoder().encode('{"format":"satchel-trip","version":1}')), 'trip');
  assert.equal(incomingName('in1', '', 'backup'), 'in1-backup.satchelbackup');
  assert.equal(maxIncomingBytes('backup'), MAX_INCOMING_BACKUP_BYTES);
  assert.equal(maxIncomingBytes('pdf'), MAX_INCOMING_BYTES);
  assert.equal(incomingRedirect('file:///private/var/mobile/Inbox/Satchel%20backup.satchelbackup'), `/openin?uri=${encodeURIComponent('file:///private/var/mobile/Inbox/Satchel%20backup.satchelbackup')}`);
});

test('app.json declares and exports app.satchel.backup (.satchelbackup) next to the trip UTI', () => {
  const plist = (JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as { expo: { ios: { infoPlist: Record<string, unknown> } } }).expo.ios.infoPlist;
  const docTypes = plist.CFBundleDocumentTypes as { CFBundleTypeName: string; LSHandlerRank: string; LSItemContentTypes: string[] }[];
  const backup = docTypes.find((d) => d.LSItemContentTypes.includes('app.satchel.backup'));
  assert.ok(backup, 'document type');
  assert.equal(backup.LSHandlerRank, 'Owner');
  const exported = plist.UTExportedTypeDeclarations as { UTTypeIdentifier: string; UTTypeConformsTo: string[]; UTTypeTagSpecification: Record<string, string[]> }[];
  assert.deepEqual(exported.map((e) => e.UTTypeIdentifier), ['app.satchel.trip', 'app.satchel.backup']);
  const b = exported[1];
  assert.ok(b.UTTypeConformsTo.includes('public.data'));
  assert.deepEqual(b.UTTypeTagSpecification['public.filename-extension'], ['satchelbackup']);
  assert.deepEqual(b.UTTypeTagSpecification['public.mime-type'], ['application/vnd.satchel.backup+json']);
});

// T162 (run 112): Expo's update publish rejected app.json's android.intentFilters as duplicated
// in the resolved config, so the VIEW filter moved to plugins/with-open-in.js (manifest mod).
test('app.json carries no android.intentFilters; the local plugin adds the VIEW filter exactly once', () => {
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')) as {
    expo: { android: Record<string, unknown>; plugins: (string | unknown[])[] };
  };
  assert.equal(app.expo.android.intentFilters, undefined, 'no intentFilters in the public config');
  assert.ok(app.expo.plugins.includes('./plugins/with-open-in'), 'plugin registered');
  const req = createRequire(import.meta.url);
  const plugin = req('../../plugins/with-open-in.js') as {
    toManifestFilter: (f: unknown) => { action: { $: Record<string, string> }[]; category: { $: Record<string, string> }[]; data: { $: Record<string, string> }[] };
    addFilter: (list: unknown, f: unknown) => unknown[];
  };
  const mf = plugin.toManifestFilter(OPEN_IN_FILTER);
  assert.equal(mf.action[0].$['android:name'], 'android.intent.action.VIEW');
  assert.equal(mf.category[0].$['android:name'], 'android.intent.category.DEFAULT');
  assert.ok(mf.data.some((d) => d.$['android:mimeType'] === 'application/vnd.satchel.backup+json'));
  assert.ok(mf.data.some((d) => d.$['android:scheme'] === 'content'));
  const deepLink = { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] };
  const once = plugin.addFilter([deepLink], mf);
  const twice = plugin.addFilter(once, plugin.toManifestFilter(OPEN_IN_FILTER));
  assert.equal(once.length, 2);
  assert.equal(twice.length, 2, 'running the mod twice adds no duplicate');
  assert.equal(plugin.addFilter(undefined, mf).length, 1);
});
