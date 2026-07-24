import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGoogleTtsUrl, buildTtsCommandResult } from '../src/tts.js';

test('builds a tts command payload from text', async () => {
  const reply = await buildTtsCommandResult('Halo dunia', {
    lang: 'ms',
    fetchAudio: async () => Buffer.from('fake-mp3'),
  });

  assert.equal(reply.type, 'tts');
  assert.equal(reply.text, 'Halo dunia');
  assert.ok(Buffer.isBuffer(reply.audioBuffer));
});

test('builds a google tts url with the selected language', () => {
  const url = buildGoogleTtsUrl('Halo dunia', 'ms');

  assert.match(url, /tl=ms/);
  assert.match(url, /q=Halo%20dunia/);
});
