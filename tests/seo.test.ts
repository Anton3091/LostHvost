import test from 'node:test';
import assert from 'node:assert/strict';
import { adSeoPath, adSeoSubject, adSeoTitle, cityForCoordinates, mainSeoSchema, slugify } from '../seo.ts';

test('SEO-описание объявления строится на русском названии животного', () => {
  const ad = { id: 'ad_1', type: 'lost' as const, category: 'cat' as const, petName: 'Мурка', city: 'Москва' };

  assert.equal(adSeoSubject(ad), 'кот Мурка');
  assert.equal(adSeoTitle(ad), 'Потерян кот Мурка, Москва — LostHvost');
  assert.equal(adSeoPath(ad), '/obyavleniya/ad_1/poteryan-kot-murka-moskva');
});

test('SEO-slug транслитерирует кириллицу и убирает лишние символы', () => {
  assert.equal(slugify('  Найден пёс — Москва!  '), 'nayden-pes-moskva');
  assert.equal(slugify('***'), 'obyavlenie');
});

test('город определяется в пределах радиуса и не определяется для далёкой точки', () => {
  assert.equal(cityForCoordinates(55.7558, 37.6173), 'Москва');
  assert.equal(cityForCoordinates(55.7558, 37.6173 + 0.5), 'Москва');
  assert.equal(cityForCoordinates(0, 0), '');
  assert.equal(cityForCoordinates(Number.NaN, 37.6173), '');
});

test('schema главной страницы содержит канонический адрес и варианты названия', () => {
  const schema = JSON.parse(mainSeoSchema());
  const website = schema['@graph'].find((item: { '@type': string }) => item['@type'] === 'WebSite');
  const faq = schema['@graph'].find((item: { '@type': string }) => item['@type'] === 'FAQPage');

  assert.equal(website.url, 'https://losthvost.ru/main');
  assert.deepEqual(website.alternateName, ['Лостхвост', 'Лост Хвост', 'Lost Hvost']);
  assert.equal(faq.mainEntity.length, 5);
  assert.equal(faq.mainEntity[4].name, 'Сколько стоит пользоваться LostHvost?');
  assert.match(faq.mainEntity[4].acceptedAnswer.text, /бесплатен/);
});
