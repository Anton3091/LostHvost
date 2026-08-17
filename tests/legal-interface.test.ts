import test from 'node:test';
import assert from 'node:assert/strict';
import { canRegister, LEGAL_DOCUMENT_PATHS, registrationConsentError } from '../src/legalDocuments.ts';

test('юридические ссылки ведут на опубликованные документы', () => {
  assert.deepEqual(LEGAL_DOCUMENT_PATHS, {
    privacy: '/privacy',
    terms: '/terms',
    personalDataConsent: '/consent',
    personalDataPublicationConsent: '/consent-publication',
  });
});

test('регистрация требует оба отдельных согласия', () => {
  assert.equal(canRegister(false, false), false);
  assert.equal(canRegister(true, false), false);
  assert.equal(canRegister(false, true), false);
  assert.equal(canRegister(true, true), true);
  assert.equal(registrationConsentError(false, true), 'Дайте согласие на обработку персональных данных');
  assert.equal(registrationConsentError(true, false), 'Примите пользовательское соглашение');
  assert.equal(registrationConsentError(true, true), null);
});
