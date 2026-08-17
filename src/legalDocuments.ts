export const LEGAL_DOCUMENT_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
  personalDataConsent: '/consent',
  personalDataPublicationConsent: '/consent-publication',
} as const;

export function registrationConsentError(
  personalDataConsent: boolean,
  termsAccepted: boolean,
) {
  if (!personalDataConsent) return 'Дайте согласие на обработку персональных данных';
  if (!termsAccepted) return 'Примите пользовательское соглашение';
  return null;
}

export function canRegister(personalDataConsent: boolean, termsAccepted: boolean) {
  return registrationConsentError(personalDataConsent, termsAccepted) === null;
}
