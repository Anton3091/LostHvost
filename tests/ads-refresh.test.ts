import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAdsCollectionState,
  getPullRefreshDistance,
  getPullRefreshPhase,
  PULL_REFRESH_MAX_DISTANCE,
  shouldRefreshAds,
} from '../src/adsRefresh.ts';

test('первая загрузка не отображается как пустой список', () => {
  assert.equal(getAdsCollectionState(true, 0), 'loading');
  assert.equal(getAdsCollectionState(false, 0), 'empty');
  assert.equal(getAdsCollectionState(false, 2), 'ready');
});

test('список обновляется при возврате в приложение и восстановлении сети', () => {
  assert.equal(shouldRefreshAds('visibilitychange', 'visible'), true);
  assert.equal(shouldRefreshAds('visibilitychange', 'hidden'), false);
  assert.equal(shouldRefreshAds('pageshow'), true);
  assert.equal(shouldRefreshAds('online'), true);
});

test('свайп вниз имеет сопротивление, порог и ограничение расстояния', () => {
  assert.equal(getPullRefreshDistance(-10), 0);
  assert.equal(getPullRefreshDistance(100), 50);
  assert.equal(getPullRefreshDistance(400), PULL_REFRESH_MAX_DISTANCE);
  assert.equal(getPullRefreshPhase(71), 'pulling');
  assert.equal(getPullRefreshPhase(72), 'ready');
});
