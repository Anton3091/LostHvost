import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mapView = readFileSync(new URL('../src/components/MapView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('действия гео-подписки расположены под описанием', () => {
  assert.match(mapView, /subscription-copy min-w-0 flex-1[\s\S]*subscription-actions flex gap-2/);
  assert.match(mapView, /subscription-edit[\s\S]*subscription-delete/);
});

test('компоненты гео-подписки соответствуют размерам макета', () => {
  assert.match(css, /\.subscription-icon \{\s*width: 40px;\s*height: 40px;/s);
  assert.match(css, /\.subscription-card \.subscription-edit,\s*\.subscription-card \.subscription-delete \{\s*min-height: 40px;\s*height: 40px;/s);
  assert.match(css, /\.subscription-card \.subscription-delete \{\s*display: inline-flex;\s*align-items: center;\s*width: 40px;/s);
  assert.match(css, /\.subscription-card \.subscription-delete \{[\s\S]*justify-content: center;[\s\S]*line-height: 0;/);
});
