import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profile = readFileSync(new URL('../src/components/ProfileView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('мобильная карточка профиля держит фото и текст в одной строке', () => {
  assert.match(profile, /profile-ad-summary flex flex-row items-start space-x-4 flex-1 w-full/);
  assert.match(profile, /w-\[84px\] h-\[84px\]/);
  assert.match(css, /\.profile-ad-summary \{\s*display: flex;\s*flex-direction: row;/s);
  assert.doesNotMatch(css, /\.profile-ad-card \{\s*display: grid;\s*grid-template-columns: 84px/s);
});
