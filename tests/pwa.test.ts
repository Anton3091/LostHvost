import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { shouldRegisterServiceWorker } from '../src/pwa.ts';

test('service worker registers before PWA installation', () => {
  assert.equal(shouldRegisterServiceWorker(true, true), true);
  assert.equal(shouldRegisterServiceWorker(false, true), false);
  assert.equal(shouldRegisterServiceWorker(true, false), false);
});

test('service worker precaches the browser icon', () => {
  const worker = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  assert.match(worker, /['"]\/icon-192\.png['"]/);
});
