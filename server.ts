import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { adSeoAction, adSeoPath, adSeoSubject, adSeoTitle, cityForCoordinates } from './seo';

const app = express();
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const appUrl = (process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');

const yandexMetrikaHead = "<script type=\"text/javascript\">\n(function(m,e,t,r,i,k,a){\n    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};\n    m[i].l=1*new Date();\n    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}\n    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)\n})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=111640132', 'ym');\nym(111640132, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:\"dataLayer\", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});\n</script>";
const yandexMetrikaBody = "<noscript><div><img src=\"https://mc.yandex.ru/watch/111640132\" style=\"position:absolute; left:-9999px;\" alt=\"\" /></div></noscript>";
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

if (production && !process.env.SMARTCAPTCHA_SERVER_KEY) throw new Error('SMARTCAPTCHA_SERVER_KEY is required');
if (production && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');

const db = new Database(path.join(dataDir, 'losthvost.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT,
 role TEXT NOT NULL DEFAULT 'user', auth_provider TEXT NOT NULL DEFAULT 'email',
 blocked_until TEXT, push_enabled INTEGER NOT NULL DEFAULT 0, email_enabled INTEGER NOT NULL DEFAULT 0,
 telegram_enabled INTEGER NOT NULL DEFAULT 0, telegram_chat_id TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ads (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL, category TEXT NOT NULL, photos TEXT NOT NULL, pet_name TEXT, contact_name TEXT NOT NULL,
 phone TEXT NOT NULL, description TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
 city TEXT,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, unpublished_at TEXT, views_count INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL, rejection_reason TEXT, complaint_count INTEGER NOT NULL DEFAULT 0,
 moderation_attempts INTEGER NOT NULL DEFAULT 0, next_moderation_at TEXT, warning_sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ads_viewport ON ads(status, lat, lng);
CREATE TABLE IF NOT EXISTS publish_attempts (user_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS phone_requests (user_id TEXT NOT NULL, ad_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, lat REAL NOT NULL, lng REAL NOT NULL, radius INTEGER NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, ad_id TEXT);
CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, type TEXT NOT NULL, request_id TEXT, component TEXT NOT NULL, user_id TEXT, ad_id TEXT, result TEXT NOT NULL, error_code TEXT, duration_ms INTEGER, details TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS logs_created ON logs(created_at);
CREATE TABLE IF NOT EXISTS action_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_queue (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, sent_at TEXT);
CREATE TABLE IF NOT EXISTS push_subscriptions (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, created_at TEXT NOT NULL);
`);
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
if (!userColumns.some(column => column.name === 'yandex_avatar_id')) db.exec('ALTER TABLE users ADD COLUMN yandex_avatar_id TEXT');
if (!userColumns.some(column => column.name === 'telegram_enabled')) db.exec('ALTER TABLE users ADD COLUMN telegram_enabled INTEGER NOT NULL DEFAULT 0');
if (!userColumns.some(column => column.name === 'telegram_chat_id')) db.exec('ALTER TABLE users ADD COLUMN telegram_chat_id TEXT');
const adColumns = db.prepare('PRAGMA table_info(ads)').all() as Array<{ name: string }>;
if (!adColumns.some(column => column.name === 'city')) db.exec('ALTER TABLE ads ADD COLUMN city TEXT');
const databaseVersion = Number(db.pragma('user_version', { simple: true }));
if (databaseVersion < 2) {
  db.prepare('UPDATE users SET push_enabled=0,email_enabled=0').run();
  db.pragma('user_version = 2');
}

type AppUser = { id: string; email: string; name: string; role: 'user' | 'master'; authProvider: 'email' | 'yandex'; avatarUrl: string | null; isBlocked: boolean; blockUntil: string | null; notificationSettings: { push: boolean; email: boolean; telegram: boolean }; telegramConnected: boolean; createdAt: string };
declare global { namespace Express { interface Request { user?: AppUser; requestId?: string } } }

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const hash = (value: string) => crypto.createHmac('sha256', process.env.SESSION_SECRET || 'development-only').update(value).digest('hex');
const rowUser = (row: any): AppUser => ({ id: row.id, email: row.email, name: row.name, role: row.role, authProvider: row.auth_provider, avatarUrl: row.yandex_avatar_id ? `https://avatars.yandex.net/get-yapic/${encodeURI(row.yandex_avatar_id)}/islands-200` : null, isBlocked: Boolean(row.blocked_until), blockUntil: row.blocked_until, notificationSettings: { push: Boolean(row.push_enabled), email: Boolean(row.email_enabled), telegram: Boolean(row.telegram_enabled && row.telegram_chat_id) }, telegramConnected: Boolean(row.telegram_chat_id), createdAt: row.created_at });
const publicAd = (row: any, userId?: string) => ({ id: row.id, type: row.type, category: row.category, photos: JSON.parse(row.photos), petName: row.pet_name || '', contactName: row.contact_name, description: row.description, lat: row.lat, lng: row.lng, city: row.city || '', createdAt: row.created_at, expiresAt: row.expires_at, status: row.status, ...(userId === row.user_id ? { viewsCount: row.views_count, isAuthor: true, unpublishedAt: row.unpublished_at, phone: row.phone, rejectionReason: row.rejection_reason } : {}) });

for (const ad of db.prepare("SELECT id,lat,lng FROM ads WHERE city IS NULL OR city='' ").all() as Array<{ id: string; lat: number; lng: number }>) {
  db.prepare('UPDATE ads SET city=? WHERE id=?').run(cityForCoordinates(ad.lat, ad.lng), ad.id);
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const xmlEscape = (value: unknown) => escapeHtml(value);
const trimmedText = (value: unknown, max = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const toSeoAd = (ad: any) => ({ id: ad.id, type: ad.type, category: ad.category, petName: ad.pet_name, city: ad.city });
const adSeoDescription = (ad: any) => {
  const seoAd = toSeoAd(ad);
  return `${adSeoAction(seoAd.type)} ${adSeoSubject(seoAd)}${seoAd.city ? `, ${seoAd.city}` : ''}. ${trimmedText(ad.description, 125)}`.slice(0, 180);
};

function renderSeoPage(ad: any) {
  const seoAd = toSeoAd(ad);
  const canonicalPath = adSeoPath(seoAd);
  const canonicalUrl = `${appUrl}${canonicalPath}`;
  const title = adSeoTitle(seoAd);
  const description = adSeoDescription(ad);
  const photo = JSON.parse(ad.photos)[0] as string | undefined;
  const imageUrl = photo ? `${appUrl}${photo}` : `${appUrl}/losthvost.png`;
  const label = adSeoAction(seoAd.type);
  const subject = adSeoSubject(seoAd);
  const published = new Date(ad.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: canonicalUrl, inLanguage: 'ru-RU', datePublished: ad.created_at, dateModified: ad.created_at, primaryImageOfPage: { '@type': 'ImageObject', contentUrl: imageUrl }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'LostHvost', item: appUrl }, { '@type': 'ListItem', position: 2, name: 'Объявление', item: canonicalUrl }] } }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#008e3a"><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(canonicalUrl)}"><link rel="icon" href="/losthvost.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="LostHvost"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta property="og:image" content="${escapeHtml(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}"><title>${escapeHtml(title)}</title><script type="application/ld+json">${schema}</script>${yandexMetrikaHead}<style>body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:auto;padding:24px 18px 48px}.brand{color:#008e3a;font-weight:800;text-decoration:none;font-size:20px}.crumbs{color:#64748b;font-size:14px;margin:20px 0}.crumbs a{color:#64748b}.card{background:#fff;border:1px solid #e2e8f0;border-radius:28px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.08)}.photo{width:100%;max-height:480px;object-fit:cover;display:block;background:#e2e8f0}.content{padding:26px}.badge{display:inline-block;padding:6px 10px;border-radius:999px;background:${ad.type === 'lost' ? '#fff7ed' : '#ecfdf5'};color:${ad.type === 'lost' ? '#c2410c' : '#047857'};font-size:13px;font-weight:700}.meta{color:#64748b;font-size:14px;margin:12px 0 20px}.description{white-space:pre-wrap}.button{display:inline-block;margin-top:22px;background:#008e3a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:14px;font-weight:700}@media (prefers-color-scheme:dark){body{background:#020617;color:#e2e8f0}.card{background:#0f172a;border-color:#1e293b}.meta,.crumbs,.crumbs a{color:#94a3b8}}</style></head><body>${yandexMetrikaBody}<main class="wrap"><a class="brand" href="/">LostHvost</a><nav class="crumbs"><a href="/">Главная</a> / Объявление${ad.city ? ` / ${escapeHtml(ad.city)}` : ''}</nav><article class="card">${photo ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(`${label} ${subject}${ad.city ? `, ${ad.city}` : ''}`)}">` : ''}<div class="content"><span class="badge">${escapeHtml(label)}</span><h1>${escapeHtml(`${label} ${subject}${ad.city ? `, ${ad.city}` : ''}`)}</h1><p class="meta">Опубликовано ${escapeHtml(published)}${ad.city ? ` · ${escapeHtml(ad.city)}` : ''}</p><p class="description">${escapeHtml(ad.description)}</p><a class="button" href="/?ad=${encodeURIComponent(ad.id)}">Открыть на карте</a></div></article></main></body></html>`;
}

function renderUnavailableSeoPage() { return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Объявление больше не опубликовано — LostHvost</title>${yandexMetrikaHead}</head><body>${yandexMetrikaBody}<p>Это объявление больше не опубликовано.</p><p><a href="/">Вернуться на LostHvost</a></p></body></html>`; }

function renderMainSeoPage() {
  const canonicalUrl = `${appUrl}/main`;
  const title = 'LostHvost — поиск пропавших животных';
  const description = 'LostHvost — поиск пропавших и найденных домашних животных. Размещайте объявления и находите питомцев на карте.';
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'LostHvost', url: canonicalUrl, description, inLanguage: 'ru-RU' }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#008e3a"><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(canonicalUrl)}"><link rel="icon" href="/losthvost.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="LostHvost"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta property="og:image" content="${escapeHtml(`${appUrl}/losthvost.png`)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><script type="application/ld+json">${schema}</script><style>body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:auto;padding:32px 18px 52px}.brand{color:#008e3a;font-weight:800;text-decoration:none;font-size:20px}.hero{margin-top:42px;background:#fff;border:1px solid #e2e8f0;border-radius:28px;padding:32px;box-shadow:0 14px 40px rgba(15,23,42,.08)}h1{font-size:clamp(30px,7vw,46px);line-height:1.08;letter-spacing:-.03em;margin:0 0 18px}h2{font-size:20px;margin:30px 0 8px}p{margin:0 0 14px;color:#475569}.button{display:inline-block;margin-top:10px;background:#008e3a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:14px;font-weight:700}.note{margin-top:24px;font-size:14px;color:#64748b}@media (prefers-color-scheme:dark){body{background:#020617;color:#e2e8f0}.hero{background:#0f172a;border-color:#1e293b}p{color:#cbd5e1}.note{color:#94a3b8}}</style></head><body><main class="wrap"><a class="brand" href="/">LostHvost</a><section class="hero"><h1>LostHvost — поиск пропавших животных</h1><p>Здесь ищут пропавших питомцев и помогают животным вернуться домой. На карте собраны объявления о потерянных и найденных домашних животных.</p><a class="button" href="/">Открыть карту LostHvost</a><h2>Как найти питомца</h2><p>Посмотрите объявления рядом с местом пропажи. Если вашего животного ещё нет на карте, добавьте объявление с фотографией, приметами и точкой на карте.</p><h2>Если вы нашли животное</h2><p>Опубликуйте находку. Хозяева смогут увидеть её на карте и связаться с вами.</p><p class="note">LostHvost помогает в поиске пропавших и найденных животных по России.</p></section></main></body></html>`;
}

function log(req: Request | undefined, type: string, component: string, details: string, result = 'info', userId?: string, adId?: string, errorCode?: string, durationMs?: number) {
  db.prepare('INSERT INTO logs VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id('log'), nowIso(), type, req?.requestId || null, component, userId || null, adId || null, result, errorCode || null, durationMs || null, details.slice(0, 1000));
}

const alertTimes = new Map<string, number>();
async function alertTelegram(key: string, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ALERT_CHAT_ID) return;
  const last = alertTimes.get(key) || 0;
  if (Date.now() - last < Number(process.env.ALERT_DEDUP_MS || 900000)) return;
  alertTimes.set(key, Date.now());
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_ALERT_CHAT_ID, text: `[LostHvost] ${text}` }) }).catch(() => undefined);
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '35mb' }));
app.use(cookieParser());
app.use((req, res, next) => { req.requestId = crypto.randomUUID(); res.setHeader('X-Request-Id', req.requestId); next(); });
app.use((req, res, next) => { if (req.path === '/' && (typeof req.query.ad === 'string' || typeof req.query.reset === 'string')) res.setHeader('X-Robots-Tag', 'noindex, follow'); next(); });
app.use((req, res, next) => { if (production && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { const origin = req.header('origin'); if (origin && origin !== appUrl) return res.status(403).json({ error: 'Недопустимый источник запроса' }); } next(); });
app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_LIMIT || 120), standardHeaders: 'draft-7', legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const geolocationDiagnosticsLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', immutable: true, fallthrough: false }));

app.use((req, _res, next) => {
  const token = req.cookies?.losthvost_session;
  if (token) {
    const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(hash(token), nowIso());
    if (row) req.user = rowUser(row);
  }
  next();
});
const requireUser = (req: Request, res: Response, next: NextFunction) => req.user ? next() : res.status(401).json({ error: 'Необходима авторизация' });
const requireMaster = (req: Request, res: Response, next: NextFunction) => req.user?.role === 'master' ? next() : res.status(403).json({ error: 'Доступ запрещён' });
const blocked = (user: AppUser) => {
  if (!user.blockUntil) return false;
  if (user.blockUntil !== 'forever' && Date.parse(user.blockUntil) <= Date.now()) { db.prepare('UPDATE users SET blocked_until=NULL WHERE id=?').run(user.id); return false; }
  return true;
};

app.post('/api/client-events/geolocation', geolocationDiagnosticsLimit, (req, res) => {
  const phases = new Set(['start', 'permission', 'success', 'error', 'stalled']);
  const stages = new Set(['initial', 'precise']);
  const permissionStates = new Set(['granted', 'denied', 'prompt', 'unsupported', 'query-error', 'unknown']);
  const platforms = new Set(['iPhone', 'iPad', 'Mac', 'other']);
  const visibilityStates = new Set(['visible', 'hidden', 'prerender', 'unloaded']);
  const cleanText = (value: unknown, maxLength: number) => typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength)
    : '';
  const attemptId = cleanText(req.body?.attemptId, 80);
  const phase = cleanText(req.body?.phase, 20);
  const stage = cleanText(req.body?.stage, 20);

  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(attemptId) || !phases.has(phase) || !stages.has(stage)) {
    return res.status(400).json({ error: 'Некорректное событие геолокации' });
  }

  const permissionState = cleanText(req.body?.permissionState, 20);
  const platform = cleanText(req.body?.platform, 20);
  const visibilityState = cleanText(req.body?.visibilityState, 20);
  const rawDuration = Number(req.body?.durationMs);
  const durationMs = Number.isFinite(rawDuration) ? Math.max(0, Math.min(120_000, Math.round(rawDuration))) : undefined;
  const rawErrorCode = Number(req.body?.errorCode);
  const errorCode = [1, 2, 3].includes(rawErrorCode) ? String(rawErrorCode) : phase === 'stalled' ? 'STALLED' : undefined;
  const details = JSON.stringify({
    attemptId,
    phase,
    stage,
    permissionState: permissionStates.has(permissionState) ? permissionState : 'unknown',
    platform: platforms.has(platform) ? platform : 'other',
    osVersion: /^\d+(?:\.\d+){0,3}$/.test(String(req.body?.osVersion || '')) ? String(req.body.osVersion) : 'unknown',
    isStandalone: req.body?.isStandalone === true,
    isSecureContext: req.body?.isSecureContext === true,
    visibilityState: visibilityStates.has(visibilityState) ? visibilityState : 'unknown',
    errorMessage: cleanText(req.body?.errorMessage, 200) || undefined
  });

  // Coordinates and the full User-Agent are intentionally neither accepted nor stored.
  log(
    req,
    'GEOLOCATION_CLIENT',
    'Geolocation',
    details,
    phase === 'success' ? 'success' : ['error', 'stalled'].includes(phase) ? 'failure' : 'info',
    undefined,
    undefined,
    errorCode,
    durationMs
  );
  res.status(204).end();
});

async function verifyCaptcha(token: unknown, ip: string) {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY;
  if (!secret && !production) return typeof token === 'string' && token.length > 0;
  if (!secret) return false;
  if (typeof token !== 'string' || !token) return false;
  const body = new URLSearchParams({ secret, token, ip });
  try {
    const response = await fetch('https://smartcaptcha.cloud.yandex.ru/validate', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const data = await response.json() as { status?: string };
    return data.status === 'ok';
  } catch {
    return false;
  }
}

function createSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 30 * 86400000);
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), userId, expires.toISOString());
  res.cookie('losthvost_session', token, { httpOnly: true, secure: production, sameSite: 'strict', path: '/', expires });
}

const smtp = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: process.env.SMTP_USERNAME ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } : undefined, requireTLS: Number(process.env.SMTP_PORT || 587) === 587 }) : null;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@losthvost.ru', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

function queueEmail(recipient: string, subject: string, html: string) { if (smtp) db.prepare('INSERT INTO email_queue VALUES (?,?,?,?,?,?,?)').run(id('mail'), recipient, subject, html, 0, nowIso(), null); }
async function sendTelegramUserNotification(chatId: string, title: string, message: string, adId?: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const text = `[LostHvost] ${title}\n${message}${adId ? `\n${appUrl}/?ad=${encodeURIComponent(adId)}` : ''}`;
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!response.ok) throw new Error(`Telegram API ${response.status}`);
}
function notify(userId: string, title: string, message: string, adId?: string) {
  db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?,?)').run(id('notif'), userId, title, message, nowIso(), 0, adId || null);
  const user: any = db.prepare('SELECT email,email_enabled,telegram_enabled,telegram_chat_id FROM users WHERE id=?').get(userId);
  if (user?.email_enabled) queueEmail(user.email, title, `<p>${message}</p><p><a href="${appUrl}">Открыть LostHvost</a></p>`);
  if (user?.telegram_enabled && user.telegram_chat_id) sendTelegramUserNotification(user.telegram_chat_id, title, message, adId).catch(error => {
    log(undefined, 'TELEGRAM_ERROR', 'Telegram', error.message, 'failure', userId, adId, 'TELEGRAM_SEND_FAILED');
    alertTelegram('telegram-user', 'Ошибка отправки пользовательского уведомления в Telegram');
  });
}

async function processEmailQueue() {
  if (!smtp) return;
  const jobs: any[] = db.prepare('SELECT * FROM email_queue WHERE sent_at IS NULL AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT 10').all(nowIso());
  for (const job of jobs) try { await smtp.sendMail({ from: process.env.SMTP_FROM || 'LostHvost <noreply@losthvost.ru>', to: job.recipient, subject: job.subject, html: job.html }); db.prepare('UPDATE email_queue SET sent_at=? WHERE id=?').run(nowIso(), job.id); } catch (error: any) { const attempts = job.attempts + 1; db.prepare('UPDATE email_queue SET attempts=?,next_attempt_at=? WHERE id=?').run(attempts, new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts)).toISOString(), job.id); log(undefined, 'EMAIL_ERROR', 'EmailWorker', error.message, 'failure', undefined, undefined, 'SMTP_ERROR'); alertTelegram('smtp', 'Ошибка отправки email'); }
}

async function processPhotos(photos: unknown, preservedPhotos: string[] = []): Promise<string[]> {
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 3) throw new Error('Требуется от 1 до 3 фотографий');
  const result: string[] = [];
  const createdPhotos: string[] = [];
  try {
    for (const photo of photos) {
      if (typeof photo === 'string' && preservedPhotos.includes(photo)) {
        result.push(photo);
        continue;
      }
      if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(photo)) throw new Error('Поддерживаются только JPEG, PNG и WebP');
      const input = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
      if (input.length > 10 * 1024 * 1024) throw new Error('Размер фотографии не должен превышать 10 МБ');
      const image = sharp(input, { animated: true, limitInputPixels: 144_000_000 });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) > 1) throw new Error('Анимированные и неподдерживаемые изображения запрещены');
      if (!meta.width || !meta.height || meta.width < 400 || meta.height < 400 || meta.width > 12000 || meta.height > 12000) throw new Error('Разрешение фотографии должно быть от 400×400 до 12000×12000');
      const name = crypto.randomUUID();
      await sharp(input).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(uploadsDir, `${name}.webp`));
      await sharp(input).rotate().resize(480, 480, { fit: 'cover' }).webp({ quality: 78 }).toFile(path.join(uploadsDir, `${name}-thumb.webp`));
      const url = `/uploads/${name}.webp`;
      result.push(url);
      createdPhotos.push(url);
    }
    return result;
  } catch (error) { for (const url of createdPhotos) { const base = path.basename(url, '.webp'); for (const suffix of ['.webp', '-thumb.webp']) fs.rmSync(path.join(uploadsDir, base + suffix), { force: true }); } throw error; }
}

function removePhotos(photos: string[]) {
  for (const url of photos) {
    const base = path.basename(url, '.webp');
    for (const suffix of ['.webp', '-thumb.webp']) fs.rmSync(path.join(uploadsDir, base + suffix), { force: true });
  }
}

async function moderate(ad: any, complaintReason?: string) {
  if (!process.env.POLZA_API_KEY) throw new Error('POLZA_API_KEY is not configured');
  const complaint = Boolean(complaintReason);
  const prompt = complaint
    ? `Проведи строгую повторную модерацию объявления о домашнем животном после жалобы: ${complaintReason}. Описание: ${ad.description}. Верни JSON вида {"shouldRemove":boolean}. Сними объявление при спаме, мошенничестве, рекламе, политике, сексуальном, запрещённом или постороннем содержании.`
    : `Проверь объявление о пропавшем или найденном домашнем животном. Тип: ${ad.type}; категория: ${ad.category}; кличка: ${ad.pet_name || 'не указана'}; описание: ${ad.description}. Проверь текст и все фотографии. Отклони рекламу, спам, политику, сексуальный и запрещённый контент, посторонний контент и фото, где животное не является главным объектом. Верни JSON вида {"approved":boolean}.`;
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const url of JSON.parse(ad.photos)) content.push({ type: 'image_url', image_url: { url: `data:image/webp;base64,${fs.readFileSync(path.join(uploadsDir, path.basename(url))).toString('base64')}`, detail: 'low' } });
  const response = await fetch(`${process.env.POLZA_BASE_URL || 'https://polza.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.POLZA_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.POLZA_MODEL || 'openai/gpt-5.6-luna-pro', messages: [{ role: 'user', content }], response_format: { type: 'json_object' }, temperature: 0, max_tokens: 200 })
  });
  const payload: any = await response.json();
  if (!response.ok) throw new Error(`Polza API ${response.status}: ${payload?.error?.message || 'request failed'}`);
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('Polza API returned an empty response');
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
}

function distance(lat1: number, lon1: number, lat2: number, lon2: number) { const r = 6371000; const p = Math.PI / 180; const a = Math.sin((lat2 - lat1) * p / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
async function approveAd(ad: any) {
  db.prepare("UPDATE ads SET status='active',expires_at=?,next_moderation_at=NULL WHERE id=?").run(new Date(Date.now() + 7 * 86400000).toISOString(), ad.id);
  const subs: any[] = db.prepare('SELECT * FROM subscriptions WHERE active=1 AND user_id<>?').all(ad.user_id);
  for (const sub of subs) if (distance(sub.lat, sub.lng, ad.lat, ad.lng) <= sub.radius) notify(sub.user_id, 'Новое объявление рядом', 'В вашей зоне геоподписки появилось новое объявление.', ad.id);
}
async function runModeration(ad: any) {
  try { const result = await moderate(ad); if (result.approved) { await approveAd(ad); notify(ad.user_id, 'Объявление опубликовано', 'Объявление прошло модерацию и опубликовано на карте.', ad.id); log(undefined, 'AD_MODERATED_APPROVED', 'Moderation', 'Объявление одобрено', 'success', ad.user_id, ad.id); } else { db.prepare("UPDATE ads SET status='rejected',rejection_reason=?,next_moderation_at=NULL WHERE id=?").run('Объявление не соответствует правилам сервиса', ad.id); notify(ad.user_id, 'Объявление отклонено', 'Объявление не прошло модерацию. Откройте профиль, чтобы изменить его.', ad.id); log(undefined, 'AD_MODERATED_REJECTED', 'Moderation', 'Объявление отклонено', 'warning', ad.user_id, ad.id); } } catch (error: any) { const attempts = ad.moderation_attempts + 1; db.prepare('UPDATE ads SET moderation_attempts=?,next_moderation_at=? WHERE id=?').run(attempts, new Date(Date.now() + Math.min(6 * 3600000, 60000 * 2 ** attempts)).toISOString(), ad.id); log(undefined, 'MODERATION_RETRY', 'Moderation', error.message, 'failure', ad.user_id, ad.id, 'MODEL_UNAVAILABLE'); alertTelegram('moderation', 'Модель модерации недоступна'); }
}

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', (_req, res) => { try { db.prepare('SELECT 1').get(); res.json({ status: 'ready' }); } catch { res.status(503).json({ status: 'unavailable' }); } });

app.get('/robots.txt', (_req, res) => { res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600'); res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${appUrl}/sitemap.xml\n`); });
app.get('/sitemap.xml', (_req, res) => {
  const rows: any[] = db.prepare("SELECT id,type,category,pet_name,city,created_at FROM ads WHERE status='active' AND expires_at>? ORDER BY created_at DESC").all(nowIso());
  const urls = rows.map(ad => `<url><loc>${xmlEscape(`${appUrl}${adSeoPath({ id: ad.id, type: ad.type, category: ad.category, petName: ad.pet_name, city: ad.city })}`)}</loc><lastmod>${new Date(ad.created_at).toISOString()}</lastmod></url>`).join('');
  res.type('application/xml').setHeader('Cache-Control', 'no-cache').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xmlEscape(`${appUrl}/`)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url><url><loc>${xmlEscape(`${appUrl}/main`)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>${urls}</urlset>`);
});
app.get('/main', (_req, res, next) => {
  if (!production) return next();
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replaceAll('LostHvost — карта пропавших и найденных животных', 'LostHvost — поиск пропавших и найденных животных')
    .replaceAll('Поиск пропавших и найденных животных на карте LostHvost. Размещайте объявления, смотрите находки рядом и помогайте питомцам вернуться домой.', 'Поиск пропавших и найденных животных на карте LostHvost. Размещайте объявления и находите питомцев рядом.')
    .replace('<link rel="canonical" href="https://losthvost.ru/" />', '<link rel="canonical" href="https://losthvost.ru/main" />')
    .replace('<meta property="og:url" content="https://losthvost.ru/" />', '<meta property="og:url" content="https://losthvost.ru/main" />');
  res.type('html').setHeader('Cache-Control', 'no-cache').send(html);
});
app.get('/obyavleniya/:id/:slug?', (req, res) => {
  const ad: any = db.prepare('SELECT * FROM ads WHERE id=?').get(req.params.id);
  if (!ad) return res.status(404).setHeader('X-Robots-Tag', 'noindex').send('Объявление не найдено');
  if (ad.status !== 'active' || Date.parse(ad.expires_at) <= Date.now()) return res.status(410).setHeader('X-Robots-Tag', 'noindex').send(renderUnavailableSeoPage());
  const canonicalPath = adSeoPath({ id: ad.id, type: ad.type, category: ad.category, petName: ad.pet_name, city: ad.city });
  if (req.path !== canonicalPath) return res.redirect(301, canonicalPath);
  res.type('html').setHeader('Cache-Control', 'public, max-age=300, s-maxage=300').send(renderSeoPage(ad));
});

app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
app.post('/api/auth/register', authLimit, async (req, res) => { try { if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || ''); const name = String(req.body.name || '').trim(); if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !name) return res.status(400).json({ error: 'Проверьте имя, email и пароль (минимум 10 символов)' }); const userId = id('user'); db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(userId, email, name, await argon2.hash(password, { type: argon2.argon2id }), nowIso()); createSession(res, userId); const user = rowUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId)); log(req, 'REGISTER_SUCCESS', 'Auth', 'Регистрация завершена', 'success', userId); res.status(201).json({ user }); } catch (error: any) { if (String(error.code).includes('CONSTRAINT')) return res.status(409).json({ error: 'Пользователь с таким email уже существует' }); throw error; } });
app.post('/api/auth/login', authLimit, async (req, res) => { if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const row: any = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase()); if (!row?.password_hash || !await argon2.verify(row.password_hash, String(req.body.password || ''))) { log(req, 'LOGIN_FAILED', 'Auth', 'Неверные учётные данные', 'warning'); return res.status(400).json({ error: 'Неверный email или пароль' }); } const user = rowUser(row); if (blocked(user)) return res.status(403).json({ error: 'Аккаунт заблокирован' }); createSession(res, user.id); log(req, 'LOGIN_SUCCESS', 'Auth', 'Вход выполнен', 'success', user.id); res.json({ user }); });
app.post('/api/auth/logout', requireUser, (req, res) => { const token = req.cookies?.losthvost_session; if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); res.clearCookie('losthvost_session', { path: '/' }); res.json({ success: true }); });
app.post('/api/auth/password/request', authLimit, async (req, res) => { if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const user: any = db.prepare("SELECT * FROM users WHERE email=? AND auth_provider='email'").get(String(req.body.email || '').trim().toLowerCase()); if (user) { const token = crypto.randomBytes(32).toString('base64url'); db.prepare("DELETE FROM action_tokens WHERE user_id=? AND purpose='reset'").run(user.id); db.prepare('INSERT INTO action_tokens VALUES (?,?,?,?)').run(hash(token), user.id, 'reset', new Date(Date.now() + 3600000).toISOString()); queueEmail(user.email, 'Восстановление пароля LostHvost', `<p><a href="${appUrl}/?reset=${encodeURIComponent(token)}">Установить новый пароль</a></p>`); } res.json({ success: true }); });
app.post('/api/auth/password/reset', authLimit, async (req, res) => { const tokenHash = hash(String(req.body.token || '')); const row: any = db.prepare("SELECT * FROM action_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>?").get(tokenHash, nowIso()); if (!row || String(req.body.password || '').length < 10) return res.status(400).json({ error: 'Ссылка недействительна или пароль слишком короткий' }); const passwordHash = await argon2.hash(String(req.body.password), { type: argon2.argon2id }); db.transaction(() => { db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash, row.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id); db.prepare('DELETE FROM action_tokens WHERE token_hash=?').run(tokenHash); })(); res.json({ success: true }); });
app.post('/api/auth/password/change', requireUser, async (req, res) => { const row: any = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user!.id); if (!row?.password_hash || !await argon2.verify(row.password_hash, String(req.body.currentPassword || '')) || String(req.body.newPassword || '').length < 10) return res.status(400).json({ error: 'Текущий пароль неверен или новый пароль слишком короткий' }); db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await argon2.hash(String(req.body.newPassword), { type: argon2.argon2id }), req.user!.id); db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(req.user!.id, hash(req.cookies.losthvost_session)); res.json({ success: true }); });
app.post('/api/auth/yandex/start', authLimit, (req, res) => { if (!process.env.YANDEX_CLIENT_ID) return res.status(503).json({ error: 'Яндекс ID пока не настроен' }); const state = crypto.randomBytes(24).toString('base64url'); res.cookie('yandex_state', state, { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 600000 }); res.json({ url: `https://oauth.yandex.ru/authorize?response_type=code&client_id=${encodeURIComponent(process.env.YANDEX_CLIENT_ID)}&redirect_uri=${encodeURIComponent(appUrl + '/api/auth/yandex/callback')}&scope=${encodeURIComponent('login:info login:email login:avatar')}&state=${state}` }); });
app.get('/api/auth/yandex/callback', async (req, res) => { if (!req.query.code || req.query.state !== req.cookies.yandex_state) return res.status(400).send('Некорректный OAuth state'); const tokenResponse = await fetch('https://oauth.yandex.ru/token', { method: 'POST', headers: { authorization: `Basic ${Buffer.from(`${process.env.YANDEX_CLIENT_ID}:${process.env.YANDEX_CLIENT_SECRET}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: appUrl + '/api/auth/yandex/callback' }) }); const token: any = await tokenResponse.json(); const infoResponse = await fetch('https://login.yandex.ru/info?format=json', { headers: { authorization: `OAuth ${token.access_token}` } }); const info: any = await infoResponse.json(); if (!info.default_email) return res.status(502).send('Яндекс не вернул email'); const avatarId = !info.is_avatar_empty && info.default_avatar_id ? String(info.default_avatar_id) : null; let row: any = db.prepare('SELECT * FROM users WHERE email=?').get(String(info.default_email).toLowerCase()); if (!row) { const userId = id('user'); db.prepare("INSERT INTO users(id,email,name,role,auth_provider,yandex_avatar_id,created_at) VALUES(?,?,?,'user','yandex',?,?)").run(userId, String(info.default_email).toLowerCase(), info.display_name || info.real_name || 'Пользователь Яндекса', avatarId, nowIso()); row = db.prepare('SELECT * FROM users WHERE id=?').get(userId); } else db.prepare('UPDATE users SET yandex_avatar_id=? WHERE id=?').run(avatarId, row.id); createSession(res, row.id); res.clearCookie('yandex_state'); res.redirect(appUrl); });

app.get('/api/ads', (req, res) => { const values: any[] = []; let where = "status='active'"; for (const [key, column, op] of [['minLat','lat','>='],['maxLat','lat','<='],['minLng','lng','>='],['maxLng','lng','<=']] as const) if (req.query[key] !== undefined) { where += ` AND ${column}${op}?`; values.push(Number(req.query[key])); } const rows = db.prepare(`SELECT * FROM ads WHERE ${where} ORDER BY created_at DESC LIMIT 1000`).all(...values); res.setHeader('Cache-Control', 'no-store'); res.json({ ads: rows.map(row => publicAd(row, req.user?.id)) }); });
app.get('/api/ads/:id', (req, res) => { const row: any = db.prepare('SELECT * FROM ads WHERE id=?').get(req.params.id); if (!row || (row.status !== 'active' && row.user_id !== req.user?.id)) return res.status(404).json({ error: 'Объявление не найдено' }); const ua = req.header('user-agent') || ''; if (req.user?.id && req.user.id !== row.user_id && !/bot|crawler|spider/i.test(ua)) db.prepare('UPDATE ads SET views_count=views_count+1 WHERE id=?').run(row.id); res.setHeader('Cache-Control', 'no-store'); res.json({ ad: publicAd(db.prepare('SELECT * FROM ads WHERE id=?').get(row.id), req.user?.id) }); });
app.get('/api/user/ads', requireUser, (req, res) => { res.setHeader('Cache-Control', 'no-store, private'); res.json({ ads: db.prepare('SELECT * FROM ads WHERE user_id=? ORDER BY created_at DESC').all(req.user!.id).map(row => publicAd(row, req.user!.id)) }); });
app.post('/api/ads', requireUser, async (req, res) => { if (blocked(req.user!)) return res.status(403).json({ error: 'Аккаунт заблокирован' }); if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const dayAgo = new Date(Date.now() - 86400000).toISOString(); if ((db.prepare("SELECT count(*) n FROM ads WHERE user_id=? AND status='active'").get(req.user!.id) as any).n >= 3) return res.status(409).json({ error: 'Достигнут лимит трёх активных объявлений' }); if ((db.prepare('SELECT count(*) n FROM publish_attempts WHERE user_id=? AND created_at>?').get(req.user!.id, dayAgo) as any).n >= 5) return res.status(429).json({ error: 'Достигнут лимит пяти попыток за 24 часа' }); db.prepare('INSERT INTO publish_attempts VALUES (?,?)').run(req.user!.id, nowIso()); try { const { type, category, petName, contactName, description } = req.body; const lat = Number(req.body.lat), lng = Number(req.body.lng); const phone = String(req.body.phone || '').replace(/[\s()-]/g, ''); if (!['lost','found'].includes(type) || !['cat','dog','other'].includes(category) || (type === 'lost' && !String(petName || '').trim()) || !String(contactName || '').trim() || !String(description || '').trim() || !/^\+[1-9]\d{7,14}$/.test(phone) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'Проверьте обязательные поля и формат телефона' }); const photos = await processPhotos(req.body.photos); const adId = id('ad'); const created = nowIso(); const city = cityForCoordinates(lat, lng); db.prepare('INSERT INTO ads(id,user_id,type,category,photos,pet_name,contact_name,phone,description,lat,lng,city,created_at,expires_at,status,next_moderation_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(adId, req.user!.id, type, category, JSON.stringify(photos), String(petName || '').trim(), String(contactName).trim(), phone, String(description).trim(), lat, lng, city, created, new Date(Date.now() + 7 * 86400000).toISOString(), 'pending_moderation', created); const ad: any = db.prepare('SELECT * FROM ads WHERE id=?').get(adId); await runModeration(ad); res.status(201).json({ ad: publicAd(db.prepare('SELECT * FROM ads WHERE id=?').get(adId), req.user!.id), status: (db.prepare('SELECT status FROM ads WHERE id=?').get(adId) as any).status }); } catch (error: any) { res.status(400).json({ error: error.message || 'Не удалось обработать объявление' }); } });
app.post('/api/ads/:id/phone', requireUser, async (req, res) => { if (blocked(req.user!)) return res.status(403).json({ error: 'Аккаунт заблокирован' }); if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const ad: any = db.prepare("SELECT * FROM ads WHERE id=? AND status='active'").get(req.params.id); if (!ad) return res.status(404).json({ error: 'Объявление не найдено' }); const count = (db.prepare('SELECT count(*) n FROM phone_requests WHERE user_id=? AND created_at>?').get(req.user!.id, new Date(Date.now() - 86400000).toISOString()) as any).n; if (count >= 10) return res.status(429).json({ error: 'Достигнут лимит десяти запросов за 24 часа' }); db.prepare('INSERT INTO phone_requests VALUES (?,?,?)').run(req.user!.id, ad.id, nowIso()); log(req, 'PHONE_REQUEST', 'PhoneSecurity', 'Запрошен контакт объявления', 'success', req.user!.id, ad.id); res.setHeader('Cache-Control', 'no-store, private'); res.json({ phone: ad.phone }); });
app.post('/api/ads/:id/unpublish', requireUser, (req, res) => { const ad: any = db.prepare('SELECT * FROM ads WHERE id=?').get(req.params.id); if (!ad || (ad.user_id !== req.user!.id && req.user!.role !== 'master')) return res.status(403).json({ error: 'Нет прав' }); db.prepare("UPDATE ads SET status='unpublished',unpublished_at=? WHERE id=?").run(nowIso(), ad.id); log(req, 'AD_UNPUBLISHED', 'Ads', 'Объявление снято', 'success', req.user!.id, ad.id); res.json({ success: true }); });
app.post('/api/ads/:id/complaint', async (req, res) => { if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' }); const ad: any = db.prepare("SELECT * FROM ads WHERE id=? AND status='active'").get(req.params.id); if (!ad) return res.status(404).json({ error: 'Объявление не найдено' }); db.prepare('UPDATE ads SET complaint_count=complaint_count+1 WHERE id=?').run(ad.id); log(req, 'COMPLAINT_RECEIVED', 'Complaint', 'Получена жалоба', 'info', req.user?.id, ad.id); try { const result = await moderate(ad, String(req.body.reason || 'Неподобающий контент')); if (result.shouldRemove) { db.prepare("UPDATE ads SET status='unpublished',unpublished_at=? WHERE id=?").run(nowIso(), ad.id); notify(ad.user_id, 'Объявление снято', 'Объявление снято после автоматической проверки жалобы.', ad.id); } } catch (error: any) { log(req, 'COMPLAINT_MODEL_ERROR', 'Complaint', error.message, 'failure', undefined, ad.id); alertTelegram('complaint-model', 'Ошибка повторной модерации'); } res.json({ success: true }); });

app.get('/api/subscription', requireUser, (req, res) => res.json({ subscription: db.prepare('SELECT user_id userId,lat,lng,radius,active isActive,created_at createdAt FROM subscriptions WHERE user_id=? AND active=1').get(req.user!.id) || null }));
app.post('/api/subscription', requireUser, (req, res) => { const radius = Number(req.body.radius), lat = Number(req.body.lat), lng = Number(req.body.lng); if (![500,1000,2000,10000].includes(radius) || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Некорректная геоподписка' }); db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,radius=excluded.radius,active=1,created_at=excluded.created_at').run(req.user!.id, lat, lng, radius, nowIso()); res.json({ subscription: { userId: req.user!.id, lat, lng, radius, isActive: true, createdAt: nowIso() } }); });
app.delete('/api/subscription', requireUser, (req, res) => { db.prepare('DELETE FROM subscriptions WHERE user_id=?').run(req.user!.id); res.json({ success: true }); });
app.get('/api/notifications', requireUser, (req, res) => res.json({ notifications: db.prepare('SELECT id,user_id userId,title,message,created_at date,read,ad_id adId FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user!.id) }));
app.put('/api/user/settings', requireUser, (req, res) => { const push = Boolean(req.body.push), email = Boolean(req.body.email); const current: any = db.prepare('SELECT telegram_chat_id FROM users WHERE id=?').get(req.user!.id); const telegram = Boolean(req.body.telegram) && Boolean(current?.telegram_chat_id); db.prepare('UPDATE users SET push_enabled=?,email_enabled=?,telegram_enabled=? WHERE id=?').run(Number(push), Number(email), Number(telegram), req.user!.id); if (!push) { db.prepare('DELETE FROM subscriptions WHERE user_id=?').run(req.user!.id); db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(req.user!.id); } res.json({ user: rowUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user!.id)) }); });
app.get('/api/push/public-key', (_req, res) => res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }));
app.post('/api/push/subscribe', requireUser, (req, res) => { if (!req.body?.endpoint) return res.status(400).json({ error: 'Некорректная подписка' }); db.prepare('INSERT INTO push_subscriptions VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,payload=excluded.payload').run(req.user!.id, req.body.endpoint, JSON.stringify(req.body), nowIso()); res.status(201).json({ success: true }); });

app.post('/api/auth/delete-account', requireUser, (req, res) => { if (req.user!.authProvider === 'yandex') { deleteUser(req.user!.id); res.clearCookie('losthvost_session', { path: '/' }); return res.json({ deleted: true }); } const token = crypto.randomBytes(32).toString('base64url'); db.prepare("DELETE FROM action_tokens WHERE user_id=? AND purpose='delete'").run(req.user!.id); db.prepare('INSERT INTO action_tokens VALUES (?,?,?,?)').run(hash(token), req.user!.id, 'delete', new Date(Date.now() + 3600000).toISOString()); queueEmail(req.user!.email, 'Удаление аккаунта LostHvost', `<p><a href="${appUrl}/api/auth/delete-account/confirm?token=${encodeURIComponent(token)}">Подтвердить удаление аккаунта</a></p>`); res.json({ confirmationRequired: true }); });
function deleteUser(userId: string) { const ads: any[] = db.prepare('SELECT photos FROM ads WHERE user_id=?').all(userId); for (const ad of ads) for (const url of JSON.parse(ad.photos)) { const base = path.basename(url, '.webp'); fs.rmSync(path.join(uploadsDir, `${base}.webp`), { force: true }); fs.rmSync(path.join(uploadsDir, `${base}-thumb.webp`), { force: true }); } db.transaction(() => { db.prepare("UPDATE logs SET user_id=NULL,details='Данные пользователя обезличены' WHERE user_id=?").run(userId); db.prepare('DELETE FROM users WHERE id=?').run(userId); })(); }
app.get('/api/auth/delete-account/confirm', (req, res) => { const tokenHash = hash(String(req.query.token || '')); const row: any = db.prepare("SELECT * FROM action_tokens WHERE token_hash=? AND purpose='delete' AND expires_at>?").get(tokenHash, nowIso()); if (!row) return res.status(400).send('Ссылка недействительна'); deleteUser(row.user_id); res.clearCookie('losthvost_session', { path: '/' }); res.redirect(appUrl + '/?deleted=1'); });

app.get('/api/master/users', requireMaster, (_req, res) => res.json({ users: db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(rowUser) }));
app.post('/api/master/block', requireMaster, (req, res) => { const until = req.body.blockUntil ? new Date(req.body.blockUntil).toISOString() : 'forever'; db.transaction(() => { db.prepare('UPDATE users SET blocked_until=? WHERE id=?').run(until, req.body.targetUserId); db.prepare("UPDATE ads SET status='unpublished',unpublished_at=? WHERE user_id=? AND status='active'").run(nowIso(), req.body.targetUserId); })(); notify(req.body.targetUserId, 'Аккаунт заблокирован', 'Доступ к функциям сервиса ограничен.'); log(req, 'MASTER_BLOCK_USER', 'Master', 'Пользователь заблокирован', 'warning', req.body.targetUserId); res.json({ success: true }); });
app.post('/api/master/unblock', requireMaster, (req, res) => { db.prepare('UPDATE users SET blocked_until=NULL WHERE id=?').run(req.body.targetUserId); log(req, 'MASTER_UNBLOCK_USER', 'Master', 'Блокировка снята', 'success', req.body.targetUserId); res.json({ success: true }); });
app.get('/api/logs', requireMaster, (_req, res) => res.json({ logs: db.prepare('SELECT id,created_at timestamp,type,request_id requestId,component,user_id userId,ad_id adId,result,error_code errorCode,duration_ms durationMs,details FROM logs ORDER BY created_at DESC LIMIT 100').all() }));

app.put('/api/ads/:id', requireUser, async (req, res) => {
  const ad: any = db.prepare('SELECT * FROM ads WHERE id=?').get(req.params.id);
  if (!ad || ad.user_id !== req.user!.id) return res.status(404).json({ error: 'Объявление не найдено' });
  if (ad.status !== 'rejected') return res.status(409).json({ error: 'Изменить можно только отклонённое объявление' });
  if (blocked(req.user!)) return res.status(403).json({ error: 'Аккаунт заблокирован' });
  if (!await verifyCaptcha(req.body.captchaToken, req.ip || '')) return res.status(400).json({ error: 'CAPTCHA не пройдена' });
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  if ((db.prepare("SELECT count(*) n FROM ads WHERE user_id=? AND status='active'").get(req.user!.id) as any).n >= 3) return res.status(409).json({ error: 'Достигнут лимит трёх активных объявлений' });
  if ((db.prepare('SELECT count(*) n FROM publish_attempts WHERE user_id=? AND created_at>?').get(req.user!.id, dayAgo) as any).n >= 5) return res.status(429).json({ error: 'Достигнут лимит пяти попыток за 24 часа' });
  db.prepare('INSERT INTO publish_attempts VALUES (?,?)').run(req.user!.id, nowIso());
  try {
    const { type, category, petName, contactName, description } = req.body;
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    const phone = String(req.body.phone || '').replace(/[\s()-]/g, '');
    if (!['lost', 'found'].includes(type) || !['cat', 'dog', 'other'].includes(category) || (type === 'lost' && !String(petName || '').trim()) || !String(contactName || '').trim() || !String(description || '').trim() || !/^\+[1-9]\d{7,14}$/.test(phone) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'Проверьте обязательные поля и формат телефона' });
    const oldPhotos: string[] = JSON.parse(ad.photos);
    const photos = await processPhotos(req.body.photos, oldPhotos);
    const created = nowIso();
    db.prepare("UPDATE ads SET type=?,category=?,photos=?,pet_name=?,contact_name=?,phone=?,description=?,lat=?,lng=?,created_at=?,status='pending_moderation',rejection_reason=NULL,moderation_attempts=0,next_moderation_at=?,unpublished_at=NULL WHERE id=?").run(type, category, JSON.stringify(photos), String(petName || '').trim(), String(contactName).trim(), phone, String(description).trim(), lat, lng, created, created, ad.id);
    removePhotos(oldPhotos.filter(photo => !photos.includes(photo)));
    const updated: any = db.prepare('SELECT * FROM ads WHERE id=?').get(ad.id);
    await runModeration(updated);
    const result: any = db.prepare('SELECT * FROM ads WHERE id=?').get(ad.id);
    res.status(200).json({ ad: publicAd(result, req.user!.id), status: result.status });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Не удалось обновить объявление' });
  }
});

app.post('/api/ads/:id/republish', requireUser, async (req, res) => {
  const ad: any = db.prepare('SELECT * FROM ads WHERE id=?').get(req.params.id);
  if (!ad || ad.user_id !== req.user!.id) return res.status(404).json({ error: 'Объявление не найдено' });
  if (ad.status !== 'unpublished') return res.status(409).json({ error: 'Опубликовать заново можно только снятое объявление' });
  if (blocked(req.user!)) return res.status(403).json({ error: 'Аккаунт заблокирован' });
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  if ((db.prepare("SELECT count(*) n FROM ads WHERE user_id=? AND status='active'").get(req.user!.id) as any).n >= 3) return res.status(409).json({ error: 'Достигнут лимит трёх активных объявлений' });
  if ((db.prepare('SELECT count(*) n FROM publish_attempts WHERE user_id=? AND created_at>?').get(req.user!.id, dayAgo) as any).n >= 5) return res.status(429).json({ error: 'Достигнут лимит пяти попыток за 24 часа' });
  db.prepare('INSERT INTO publish_attempts VALUES (?,?)').run(req.user!.id, nowIso());
  const created = nowIso();
  db.prepare("UPDATE ads SET status='pending_moderation',rejection_reason=NULL,moderation_attempts=0,next_moderation_at=?,unpublished_at=NULL,created_at=? WHERE id=?").run(created, created, ad.id);
  await runModeration(db.prepare('SELECT * FROM ads WHERE id=?').get(ad.id));
  const result: any = db.prepare('SELECT * FROM ads WHERE id=?').get(ad.id);
  res.status(200).json({ ad: publicAd(result, req.user!.id), status: result.status });
});

app.get('/api/integrations/telegram/link', requireUser, (req, res) => {
  const username = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
  if (!process.env.TELEGRAM_BOT_TOKEN || !username) return res.status(503).json({ error: 'Telegram пока не настроен' });
  const token = crypto.randomBytes(24).toString('base64url');
  db.prepare("DELETE FROM action_tokens WHERE user_id=? AND purpose='telegram_link'").run(req.user!.id);
  db.prepare('INSERT INTO action_tokens VALUES (?,?,?,?)').run(hash(token), req.user!.id, 'telegram_link', new Date(Date.now() + 15 * 60_000).toISOString());
  res.json({ url: `https://t.me/${username}?start=${token}` });
});

app.post('/api/integrations/telegram/webhook', async (req, res) => {
  const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
  if (expectedSecret && req.header('x-telegram-bot-api-secret-token') !== expectedSecret) return res.status(403).json({ error: 'Доступ запрещён' });
  const message = req.body?.message;
  const text = typeof message?.text === 'string' ? message.text : '';
  const token = text.match(/^\/start(?:@[^\s]+)?\s+([A-Za-z0-9_-]+)$/)?.[1];
  if (!token || !message?.chat?.id) return res.json({ ok: true });
  const action: any = db.prepare("SELECT * FROM action_tokens WHERE token_hash=? AND purpose='telegram_link' AND expires_at>? ").get(hash(token), nowIso());
  if (!action) return res.json({ ok: true });
  db.transaction(() => {
    db.prepare('UPDATE users SET telegram_chat_id=?,telegram_enabled=1 WHERE id=?').run(String(message.chat.id), action.user_id);
    db.prepare('DELETE FROM action_tokens WHERE token_hash=?').run(action.token_hash);
  })();
  await sendTelegramUserNotification(String(message.chat.id), 'Telegram подключён', 'Теперь вы будете получать уведомления LostHvost в этом чате.').catch(() => undefined);
  res.json({ ok: true });
});

async function background() {
  try {
    const pending: any[] = db.prepare("SELECT * FROM ads WHERE status='pending_moderation' AND next_moderation_at<=? LIMIT 10").all(nowIso()); for (const ad of pending) await runModeration(ad);
    const warningRows: any[] = db.prepare("SELECT * FROM ads WHERE status='active' AND warning_sent=0 AND expires_at<=?").all(new Date(Date.now() + 86400000).toISOString()); for (const ad of warningRows) { db.prepare('UPDATE ads SET warning_sent=1 WHERE id=?').run(ad.id); notify(ad.user_id, 'Осталось 24 часа', 'Объявление будет снято с публикации через 24 часа.', ad.id); }
    const expired: any[] = db.prepare("SELECT * FROM ads WHERE status='active' AND expires_at<=?").all(nowIso()); for (const ad of expired) { db.prepare("UPDATE ads SET status='unpublished',unpublished_at=? WHERE id=?").run(nowIso(), ad.id); notify(ad.user_id, 'Срок публикации истёк', 'Объявление автоматически снято с публикации.', ad.id); }
    db.prepare("UPDATE users SET blocked_until=NULL WHERE blocked_until<>'forever' AND blocked_until<=?").run(nowIso());
    const oldAds: any[] = db.prepare("SELECT * FROM ads WHERE status<>'active' AND COALESCE(unpublished_at,created_at)<=datetime('now','-90 days')").all(); for (const ad of oldAds) { for (const url of JSON.parse(ad.photos)) { const base = path.basename(url, '.webp'); fs.rmSync(path.join(uploadsDir, `${base}.webp`), { force: true }); fs.rmSync(path.join(uploadsDir, `${base}-thumb.webp`), { force: true }); } db.prepare('DELETE FROM ads WHERE id=?').run(ad.id); }
    db.prepare("DELETE FROM logs WHERE created_at<=datetime('now','-365 days')").run(); db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(nowIso()); db.prepare('DELETE FROM action_tokens WHERE expires_at<=?').run(nowIso());
    await processEmailQueue();
    if (process.env.VAPID_PUBLIC_KEY) { const messages: any[] = db.prepare('SELECT n.*,p.endpoint,p.payload FROM notifications n JOIN users u ON u.id=n.user_id JOIN push_subscriptions p ON p.user_id=n.user_id WHERE n.read=0 AND u.push_enabled=1 ORDER BY n.created_at LIMIT 20').all(); for (const item of messages) try { await webpush.sendNotification(JSON.parse(item.payload), JSON.stringify({ title: item.title, body: item.message, url: item.ad_id ? `/?ad=${item.ad_id}` : '/' })); db.prepare('UPDATE notifications SET read=1 WHERE id=?').run(item.id); } catch (error: any) { if ([404,410].includes(error.statusCode)) db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(item.endpoint); } }
  } catch (error: any) { log(undefined, 'BACKGROUND_ERROR', 'Scheduler', error.message, 'failure'); alertTelegram('background', 'Ошибка фоновой задачи'); }
}
setInterval(background, 60_000).unref(); setTimeout(background, 5000).unref();

app.use((error: any, req: Request, res: Response, _next: NextFunction) => { log(req, 'API_ERROR', 'Express', error.message, 'failure', req.user?.id, undefined, 'INTERNAL_ERROR'); alertTelegram('api-5xx', 'Ошибка API 500'); res.status(500).json({ error: 'Сервер временно недоступен', requestId: req.requestId }); });

async function ensureMaster() { const email = String(process.env.MASTER_EMAIL || '').trim().toLowerCase(); const password = String(process.env.MASTER_PASSWORD || ''); if (!email || password.length < 16) return; const existing: any = db.prepare('SELECT id FROM users WHERE email=?').get(email); if (existing) { db.prepare("UPDATE users SET role='master' WHERE id=?").run(existing.id); return; } db.prepare("INSERT INTO users(id,email,name,password_hash,role,auth_provider,created_at) VALUES(?,?,?,?,'master','email',?)").run(id('user'), email, 'Мастер LostHvost', await argon2.hash(password, { type: argon2.argon2id }), nowIso()); }
async function start() { await ensureMaster(); if (!production) { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); } else { const dist = path.join(process.cwd(), 'dist'); app.use(express.static(dist, { maxAge: '1h' })); app.use((_req, res) => res.status(404).type('html').setHeader('X-Robots-Tag', 'noindex').send('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Страница не найдена — LostHvost</title><body><p>Страница не найдена.</p><p><a href="/">Вернуться на LostHvost</a></p></body></html>')); } app.listen(port, '0.0.0.0', () => console.log(`LostHvost listening on ${port}`)); }
start();
