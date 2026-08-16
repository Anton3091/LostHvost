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

test('service worker precaches the current brand icon', () => {
  const worker = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  assert.match(worker, /['"]\/losthvost-transparent\.png['"]/);
});

test('manifest uses the current brand icon for installed PWA', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.webmanifest'), 'utf8'));
  assert.deepEqual(manifest.icons, [
    { src: '/losthvost-transparent.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
    { src: '/losthvost-transparent.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
  ]);
});
