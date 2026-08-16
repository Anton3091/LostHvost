export const AD_PUBLICATION_DAYS = 14;
const AD_PUBLICATION_MS = AD_PUBLICATION_DAYS * 86400000;

export const adExpiresAt = (createdAt: number = Date.now()) =>
  new Date(createdAt + AD_PUBLICATION_MS).toISOString();
