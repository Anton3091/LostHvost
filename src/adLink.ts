export const getAdLink = (origin: string, adId: string): string =>
  `${origin}/?ad=${encodeURIComponent(adId)}`;
