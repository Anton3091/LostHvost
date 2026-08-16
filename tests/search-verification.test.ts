import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('подтверждения Яндекса и Google опубликованы в исходниках', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const yandexFile = readFileSync(new URL('../public/yandex_6ee8c680068ccc1e.html', import.meta.url), 'utf8');

  assert.match(index, /google-site-verification" content="Phz4x_zHYP6aECOHOm_EZQklhu1sVqU7BDeygLEK3X4"/);
  assert.match(yandexFile, /Verification: 6ee8c680068ccc1e/);
});
