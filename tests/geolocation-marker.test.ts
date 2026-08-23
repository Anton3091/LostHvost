import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mapView = readFileSync(new URL('../src/components/MapView.tsx', import.meta.url), 'utf8');

test('маркер геоподписки не дублируется на обычной карте', () => {
  assert.match(mapView, /if \(isSubMode\) \{\s*const centerIcon = L\.divIcon/s);
  assert.match(mapView, /draggable: true/);
});

test('маркер текущей геолокации использует иконку геометки', () => {
  assert.match(mapView, /className: 'pulse-gps-marker'/);
  assert.match(mapView, /html: '<svg viewBox="0 0 24 24" width="12"/);
});
