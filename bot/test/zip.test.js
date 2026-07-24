import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

import {
  buildZipArchiveBuffer,
  buildUnzipCommandReply,
  buildZipCommandReply,
  unzipTextFromBase64,
  zipTextToBase64,
} from '../src/zip.js';

test('zip and unzip preserve the original text', () => {
  const input = 'Halo dunia dari Routebot';
  const zipped = zipTextToBase64(input);

  assert.ok(zipped.length > 0);
  assert.equal(unzipTextFromBase64(zipped), input);
});

test('buildZipCommandReply returns a gzip payload', () => {
  const reply = buildZipCommandReply('route 3PVK04 aktif');
  const payload = reply.split('\n').at(-1);

  assert.match(reply, /ZIP Result/);
  assert.equal(unzipTextFromBase64(payload), 'route 3PVK04 aktif');
});

test('buildUnzipCommandReply reports invalid payloads', () => {
  const reply = buildUnzipCommandReply('bukan-payload-sah');

  assert.match(reply, /tidak sah/i);
});

test('buildZipArchiveBuffer creates a valid zip archive', async () => {
  const archiveBuffer = await buildZipArchiveBuffer(Buffer.from('hello world'), 'photo.jpg');

  assert.ok(Buffer.isBuffer(archiveBuffer));

  const zip = await JSZip.loadAsync(archiveBuffer);
  assert.deepEqual(Object.keys(zip.files), ['photo.jpg']);
  assert.equal(await zip.file('photo.jpg').async('string'), 'hello world');
});