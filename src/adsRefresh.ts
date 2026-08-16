export type AdsCollectionState = 'loading' | 'empty' | 'ready';
export type AdsRefreshTrigger = 'visibilitychange' | 'pageshow' | 'online';
export type PullRefreshPhase = 'pulling' | 'ready';

export const PULL_REFRESH_THRESHOLD = 72;
export const PULL_REFRESH_MAX_DISTANCE = 104;

export function getAdsCollectionState(isLoading: boolean, adsCount: number): AdsCollectionState {
  if (isLoading) return 'loading';
  return adsCount === 0 ? 'empty' : 'ready';
}

export function shouldRefreshAds(trigger: AdsRefreshTrigger, visibilityState: DocumentVisibilityState = 'visible') {
  return trigger !== 'visibilitychange' || visibilityState === 'visible';
}

export function getPullRefreshDistance(deltaY: number) {
  return Math.min(PULL_REFRESH_MAX_DISTANCE, Math.max(0, deltaY) * 0.5);
}

export function getPullRefreshPhase(distance: number): PullRefreshPhase {
  return distance >= PULL_REFRESH_THRESHOLD ? 'ready' : 'pulling';
}
