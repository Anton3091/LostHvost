import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_PUBLICATION_DAYS, adExpiresAt } from '../src/adPublication.ts';

test('объявление действует 14 суток', () => {
  const createdAt = Date.parse('2026-01-01T00:00:00.000Z');

  assert.equal(AD_PUBLICATION_DAYS, 14);
  assert.equal(adExpiresAt(createdAt), '2026-01-15T00:00:00.000Z');
});
