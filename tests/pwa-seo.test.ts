import test from 'node:test';
import assert from 'node:assert/strict';
import { isStandalonePwa } from '../src/geolocation.ts';
import { mainSeoSchema } from '../seo.ts';

test('плашка обновления ограничена установленным PWA', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setBrowserGlobals = (windowValue: unknown, navigatorValue: unknown) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowValue });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorValue });
  };

  try {
    setBrowserGlobals({ matchMedia: () => ({ matches: false }) }, { standalone: false });
    assert.equal(isStandalonePwa(), false);

    setBrowserGlobals({ matchMedia: () => ({ matches: true }) }, { standalone: false });
    assert.equal(isStandalonePwa(), true);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
});

test('schema главной страницы указывает канонический адрес и варианты названия', () => {
  const schema = JSON.parse(mainSeoSchema());
  const website = schema['@graph'].find((item: { '@type': string }) => item['@type'] === 'WebSite');

  assert.equal(website.url, 'https://losthvost.ru/main');
  assert.deepEqual(website.alternateName, ['Лостхвост', 'Лост Хвост', 'Lost Hvost']);
});
