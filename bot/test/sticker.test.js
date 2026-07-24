import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStickerCommandReply, parseStickerCommandFlags } from '../src/sticker.js';

test('parseStickerCommandFlags detects nobg keywords', () => {
  const a = parseStickerCommandFlags('nobg');
  const b = parseStickerCommandFlags('please no-bg');
  const c = parseStickerCommandFlags('transparent');

  assert.equal(a.removeBackground, true);
  assert.equal(b.removeBackground, true);
  assert.equal(c.removeBackground, true);
});

test('buildStickerCommandReply rejects unsupported media type', async () => {
  const reply = await buildStickerCommandReply(Buffer.from('abc'), {
    mediaType: 'audio',
    removeBackground: false,
  });

  assert.equal(reply.type, 'sticker');
  assert.equal(reply.stickerBuffer, null);
  assert.match(reply.text, /tidak disokong/i);
});

test('buildStickerCommandReply rejects nobg on video', async () => {
  const reply = await buildStickerCommandReply(Buffer.from('abc'), {
    mediaType: 'video',
    removeBackground: true,
  });

  assert.equal(reply.type, 'sticker');
  assert.equal(reply.stickerBuffer, null);
  assert.match(reply.text, /hanya untuk gambar/i);
});
