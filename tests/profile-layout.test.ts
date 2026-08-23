import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profile = readFileSync(new URL('../src/components/ProfileView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('мобильная карточка профиля держит фото и текст в одной строке', () => {
  assert.match(profile, /profile-ad-summary flex flex-row items-start space-x-4 flex-1 w-full/);
  assert.match(profile, /profile-ad-photo/);
  assert.match(css, /\.profile-ad-summary \{\s*display: flex;\s*flex-direction: row;/s);
  assert.match(css, /\.profile-ad-photo \{\s*width: 96px;\s*height: 96px;/s);
});

test('статус и действие объявления следуют структуре макета', () => {
  assert.match(profile, /profile-ad-copy[\s\S]*profile-ad-status/);
  assert.match(profile, /profile-ad-actions/);
  assert.doesNotMatch(profile, /absolute -bottom-2\.5/);
  assert.match(css, /\.profile-ad-actions \{\s*min-height: 46px;\s*border-top: 1px solid var\(--line\);/s);
});
