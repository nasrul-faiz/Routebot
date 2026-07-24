import test from 'node:test';
import assert from 'node:assert/strict';

import { unzipTextFromBase64 } from '../src/zip.js';
import { buildTtsAudioMessage, executeCommand, normalizePhoneNumber } from '../src/index.js';

test('accepts dot-prefixed numeric location commands', async () => {
  const reply = await executeCommand('.33', {
    commandPrefix: '!',
    http: {
      async get() {
        return {
          data: {
            success: true,
            data: [
              {
                code: 'R1',
                name: 'Route 1',
                shift: 'AM',
                deliveryPoints: [
                  {
                    code: '33',
                    name: 'Stop 33',
                  },
                ],
              },
            ],
          },
        };
      },
    },
  });

  assert.equal(reply.type, 'location');
  assert.equal(reply.point.code, '33');
});

test('builds tts audio payload', () => {
  const payload = buildTtsAudioMessage(Buffer.from('fake-mp3'));

  assert.equal(payload.mimetype, 'audio/mpeg');
  assert.equal(payload.ptt, false);
  assert.ok(Buffer.isBuffer(payload.audio));
});

test('normalizes phone numbers for pairing', () => {
  assert.equal(normalizePhoneNumber('+60 12-345 6789'), '60123456789');
});

test('zip command can read quoted chat text', async () => {
  const reply = await executeCommand('.zip', {
    commandPrefix: '.',
    http: {
      async get() {
        throw new Error('not used');
      },
    },
  }, {
    extendedTextMessage: {
      contextInfo: {
        quotedMessage: {
          conversation: 'Halo dunia dari reply',
        },
      },
    },
  });

  const payload = reply.split('\n').at(-1);
  assert.equal(unzipTextFromBase64(payload), 'Halo dunia dari reply');
});

test('zip command can read quoted media caption', async () => {
  const reply = await executeCommand('.zip', {
    commandPrefix: '.',
    http: {
      async get() {
        throw new Error('not used');
      },
    },
  }, {
    imageMessage: {
      contextInfo: {
        quotedMessage: {
          imageMessage: {
            caption: 'Teks dari media',
          },
        },
      },
    },
  });

  const payload = reply.split('\n').at(-1);
  assert.equal(unzipTextFromBase64(payload), 'Teks dari media');
});

test('sticker command asks to reply media when no quoted media', async () => {
  const reply = await executeCommand('.sticker', {
    commandPrefix: '.',
    http: {
      async get() {
        throw new Error('not used');
      },
    },
    async buildStickerCommandReply() {
      throw new Error('should not be called');
    },
  });

  assert.match(reply, /Reply gambar\/video/i);
});

test('sticker command passes nobg flag to sticker builder', async () => {
  const calls = [];
  const reply = await executeCommand('.sticker nobg', {
    commandPrefix: '.',
    http: {
      async get() {
        throw new Error('not used');
      },
    },
    async buildStickerCommandReply(mediaBuffer, options) {
      calls.push({ mediaBuffer, options });
      return {
        type: 'sticker',
        stickerBuffer: Buffer.from('fake-webp'),
      };
    },
    async downloadQuotedMediaBuffer() {
      return Buffer.from('fake-image');
    },
  }, {
    extendedTextMessage: {
      contextInfo: {
        quotedMessage: {
          imageMessage: {
            url: 'https://example.com/photo.jpg',
          },
        },
      },
    },
  });

  assert.equal(reply.type, 'sticker');
  assert.ok(Buffer.isBuffer(reply.stickerBuffer));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.mediaType, 'image');
  assert.equal(calls[0].options.removeBackground, true);
});