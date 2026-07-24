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

test('builds tts voice note payload', () => {
  const payload = buildTtsAudioMessage(Buffer.from('fake-mp3'));

  assert.equal(payload.mimetype, 'audio/mpeg');
  assert.equal(payload.ptt, true);
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