import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdLink } from '../src/adLink';

test('builds an announcement link with an encoded ad id', () => {
  assert.equal(
    getAdLink('https://losthvost.ru', 'ad/ кот 12'),
    'https://losthvost.ru/?ad=ad%2F%20%D0%BA%D0%BE%D1%82%2012'
  );
});
