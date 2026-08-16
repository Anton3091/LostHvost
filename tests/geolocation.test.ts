import test from 'node:test';
import assert from 'node:assert/strict';
import { isGeolocationPermissionDenied, isStandalonePwa } from '../src/geolocation.ts';

test('ошибка разрешения геолокации определяется по коду 1', () => {
  assert.equal(isGeolocationPermissionDenied({ code: 1 }), true);
  assert.equal(isGeolocationPermissionDenied({ code: 2 }), false);
  assert.equal(isGeolocationPermissionDenied(new Error('denied')), false);
});

test('PWA определяется по display-mode и флагу Safari', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setBrowserGlobals = (windowValue: unknown, navigatorValue: unknown) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowValue });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorValue });
  };

  setBrowserGlobals({ matchMedia: () => ({ matches: true }) }, { standalone: false });
  assert.equal(isStandalonePwa(), true);

  setBrowserGlobals({ matchMedia: () => ({ matches: false }) }, { standalone: true });
  assert.equal(isStandalonePwa(), true);

  setBrowserGlobals({ matchMedia: () => ({ matches: false }) }, { standalone: false });
  assert.equal(isStandalonePwa(), false);

  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete (globalThis as { window?: unknown }).window;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
});
