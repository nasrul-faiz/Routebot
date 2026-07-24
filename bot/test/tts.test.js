import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGoogleTtsUrl, buildTtsCommandResult } from '../src/tts.js';

test('builds a tts command payload from text', async () => {
  const reply = await buildTtsCommandResult('Halo dunia', { lang: 'ms' });

  assert.equal(reply.type, 'tts');
  assert.equal(reply.text, 'Halo dunia');
});

test('builds a google tts url with the selected language', () => {
  const url = buildGoogleTtsUrl('Halo dunia', 'ms');

  assert.match(url, /tl=ms/);
  assert.match(url, /q=Halo%20dunia/);
});
