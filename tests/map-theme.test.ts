import assert from 'node:assert/strict';
import test from 'node:test';
import { withCartoBasemapKey } from '../src/theme.ts';

test('добавляет ключ CARTO к URL растрового слоя', () => {
  assert.equal(
    withCartoBasemapKey('https://tiles.example/{z}/{x}/{y}.png', 'carto-key'),
    'https://tiles.example/{z}/{x}/{y}.png?key=carto-key'
  );
});

test('оставляет URL без ключа для локальной разработки без настройки', () => {
  assert.equal(
    withCartoBasemapKey('https://tiles.example/{z}/{x}/{y}.png', ''),
    'https://tiles.example/{z}/{x}/{y}.png'
  );
});
