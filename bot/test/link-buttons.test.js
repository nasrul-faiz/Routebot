import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocationLinks, chunkLinksForButtons } from '../src/link-buttons.js';

test('keeps waze in the first button batch when there are four links', () => {
  const point = {
    code: '1234',
    latitude: 3.139,
    longitude: 101.686,
    qrCodeDestinationUrl: 'https://example.com/qr',
  };

  const links = buildLocationLinks(point);
  const chunks = chunkLinksForButtons(links);

  assert.deepEqual(
    links.map((link) => link.label),
    ['Familymart', 'Google Maps', 'waze', 'QR'],
  );
  assert.deepEqual(
    chunks[0].map((link) => link.label),
    ['Familymart', 'Google Maps', 'waze'],
  );
  assert.deepEqual(chunks[1].map((link) => link.label), ['QR']);
});
