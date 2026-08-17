import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { Server } from 'node:http';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'losthvost-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = dataDir;
process.env.SESSION_SECRET = 'test-session-secret';
process.env.SMARTCAPTCHA_SERVER_KEY = '';
process.env.API_RATE_LIMIT = '1000';

let app: Express;
let publicationDays: number;
let server: Server;
let baseUrl = '';

before(async () => {
  ({ app, AD_PUBLICATION_DAYS: publicationDays } = await import('../server.ts'));
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server?.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function request(pathname: string, init?: RequestInit) {
  return fetch(`${baseUrl}${pathname}`, init);
}

test('служебные проверки живости и готовности возвращают OK', async () => {
  const live = await request('/health/live');
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: 'ok' });

  const ready = await request('/health/ready');
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: 'ready' });
});

test('политика опубликована отдельно и закрыта от индексации', async () => {
  const response = await request('/privacy');
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html, /Политика обработки персональных данных/);
  assert.match(html, /antonbolyatko@yandex\.ru/);
});

test('запрет индексации политики не применяется к другим страницам', async () => {
  const response = await request('/health/ready');

  assert.equal(response.headers.get('x-robots-tag'), null);
});

test('срок публикации объявления составляет 14 суток', () => {
  assert.equal(publicationDays, 14);
});

test('защищённый маршрут требует авторизацию', async () => {
  const response = await request('/api/user/ads');
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Необходима авторизация' });
});

test('тестовое push-уведомление требует авторизацию', async () => {
  const response = await request('/api/push/test', { method: 'POST' });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Необходима авторизация' });
});

test('регистрация создаёт сессию и возвращает нормализованный профиль', async () => {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      captchaToken: 'test-captcha',
      email: '  TEST@example.com ',
      password: 'correct horse battery staple',
      name: '  Тестовый пользователь  '
    })
  });

  assert.equal(response.status, 201);
  const payload = await response.json() as { user: { email: string; name: string } };
  assert.equal(payload.user.email, 'test@example.com');
  assert.equal(payload.user.name, 'Тестовый пользователь');

  const setCookie = response.headers.get('set-cookie') || '';
  const sessionCookie = setCookie.match(/losthvost_session=[^;]+/)?.[0];
  assert.ok(sessionCookie);

  const me = await request('/api/auth/me', { headers: { cookie: sessionCookie } });
  assert.equal(me.status, 200);
  const mePayload = await me.json() as { user: { email: string } };
  assert.equal(mePayload.user.email, 'test@example.com');
});

test('диагностика геолокации отклоняет неправильное событие и принимает корректное', async () => {
  const invalid = await request('/api/client-events/geolocation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ attemptId: 'bad id', phase: 'start', stage: 'initial' })
  });
  assert.equal(invalid.status, 400);

  const valid = await request('/api/client-events/geolocation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      attemptId: 'attempt_123',
      phase: 'success',
      stage: 'initial',
      permissionState: 'granted',
      platform: 'iPhone',
      osVersion: '18.5',
      durationMs: 240,
      isStandalone: true,
      isSecureContext: true,
      visibilityState: 'visible'
    })
  });
  assert.equal(valid.status, 204);
});
