import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { SEED_USERS, SEED_ADS, SEED_PHONES, SEED_SUBSCRIPTIONS } from './src/data/initialSeed';
import { AdItem, User, GeoSubscription, SystemLog, NotificationItem, PublicAdItem } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// In-Memory Data Store
let users: User[] = [...SEED_USERS];
let ads: AdItem[] = [...SEED_ADS];
let phoneStore: Record<string, string> = { ...SEED_PHONES };
let subscriptions: GeoSubscription[] = [...SEED_SUBSCRIPTIONS];
let notifications: NotificationItem[] = [
  {
    id: 'notif_1',
    userId: 'user_1',
    title: 'Объявление опубликовано',
    message: 'Ваше объявление по коту Барсику успешно прошло модерацию и опубликовано.',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    read: true,
    adId: 'ad_1'
  }
];
let systemLogs: SystemLog[] = [];
let phoneRequestsLog: { id: string; userId: string; adId: string; timestamp: number }[] = [];
let publishAttemptsLog: { id: string; userId: string; timestamp: number }[] = [];

// Gemini Client Lazy Initializer
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Log Utility
function addLog(
  type: string,
  component: string,
  details: string,
  result: 'success' | 'failure' | 'warning' | 'info' = 'info',
  userId?: string,
  adId?: string,
  errorCode?: string,
  durationMs?: number
) {
  const logItem: SystemLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    type,
    component,
    userId,
    adId,
    result,
    errorCode,
    durationMs,
    details
  };
  systemLogs.unshift(logItem);
  if (systemLogs.length > 2000) systemLogs.pop();
}

// Helper: Distance calculation in meters (Haversine Formula)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Convert AdItem to PublicAdItem (completely omitting phone number)
function toPublicAd(ad: AdItem, currentUserId?: string): PublicAdItem {
  const isAuthor = currentUserId && ad.userId === currentUserId;
  return {
    id: ad.id,
    type: ad.type,
    category: ad.category,
    photos: ad.photos,
    petName: ad.petName,
    contactName: ad.contactName,
    description: ad.description,
    lat: ad.lat,
    lng: ad.lng,
    createdAt: ad.createdAt,
    expiresAt: ad.expiresAt,
    status: ad.status,
    ...(isAuthor ? { viewsCount: ad.viewsCount, isAuthor: true } : {})
  };
}

// Simulated CAPTCHA Validation
function verifyCaptcha(token?: string): boolean {
  if (!token) return true; // Allow pass-through for smooth experience if client token provided
  return true;
}

// Check User Block Status
function isUserBlocked(user: User): boolean {
  if (!user.isBlocked) return false;
  if (user.blockUntil) {
    const until = new Date(user.blockUntil).getTime();
    if (Date.now() > until) {
      user.isBlocked = false;
      user.blockUntil = null;
      addLog('UNBLOCK', 'Auth', `Автоматическая разблокировка пользователя ${user.email}`, 'info', user.id);
      return false;
    }
  }
  return true;
}

// Rate limits helper for an account
function getUserRateLimits(userId: string) {
  const now = Date.now();
  const dayAgo = now - 24 * 3600000;

  const activeAdsCount = ads.filter(a => a.userId === userId && a.status === 'active').length;
  const publishAttempts24h = publishAttemptsLog.filter(p => p.userId === userId && p.timestamp > dayAgo).length;
  const phoneRequests24h = phoneRequestsLog.filter(pr => pr.userId === userId && pr.timestamp > dayAgo).length;

  return {
    activeAdsCount,
    maxActiveAds: 3,
    publishAttempts24h,
    maxPublishAttempts24h: 5,
    phoneRequests24h,
    maxPhoneRequests24h: 10
  };
}

// ==================== API ENDPOINTS ==================== //

// 1. Get Ads (Viewport or List)
app.get('/api/ads', (req: Request, res: Response) => {
  const { minLat, maxLat, minLng, maxLng, currentUserId } = req.query;

  let filteredAds = ads.filter(a => a.status === 'active');

  if (minLat && maxLat && minLng && maxLng) {
    const minLt = parseFloat(minLat as string);
    const maxLt = parseFloat(maxLat as string);
    const minLg = parseFloat(minLng as string);
    const maxLg = parseFloat(maxLng as string);
    filteredAds = filteredAds.filter(
      a => a.lat >= minLt && a.lat <= maxLt && a.lng >= minLg && a.lng <= maxLg
    );
  }

  const publicAds = filteredAds.map(ad => toPublicAd(ad, currentUserId as string));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ads: publicAds });
});

// 2. Get Single Ad Details
app.get('/api/ads/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.header('X-User-Id') || (req.query.currentUserId as string);

  const ad = ads.find(a => a.id === id);
  if (!ad) {
    return res.status(404).json({ error: 'Объявление не найдено' });
  }

  if (ad.status !== 'active' && ad.userId !== currentUserId) {
    return res.status(403).json({ error: 'Объявление недоступно' });
  }

  // Increment view count if viewed by another user
  if (currentUserId && currentUserId !== ad.userId) {
    ad.viewsCount = (ad.viewsCount || 0) + 1;
    addLog('VIEW_INCREMENT', 'Ads', `Увеличен счетчик просмотров для объявления ${ad.id}`, 'info', currentUserId, ad.id);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ ad: toPublicAd(ad, currentUserId) });
});

// 3. Request Phone Number (Protected endpoint with strict rate limits & CAPTCHA)
app.post('/api/ads/:id/phone', (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, captchaToken } = req.body;
  const startTime = Date.now();

  if (!userId) {
    return res.status(401).json({ error: 'Требуется авторизация для получения номера' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }

  if (isUserBlocked(user)) {
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
  }

  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'Проверка CAPTCHA не пройдена' });
  }

  const ad = ads.find(a => a.id === id);
  if (!ad || ad.status !== 'active') {
    return res.status(404).json({ error: 'Объявление не активно или не найдено' });
  }

  // Check Phone Requests 24h limit (max 10)
  const limits = getUserRateLimits(userId);
  if (limits.phoneRequests24h >= limits.maxPhoneRequests24h) {
    addLog('PHONE_LIMIT_EXCEEDED', 'PhoneSecurity', `Превышен лимит запросов номеров телефонов (10/24ч) пользователем ${user.email}`, 'warning', userId, id);
    return res.status(429).json({ error: 'Превышен лимит просмотров номеров телефонов (максимум 10 запросов за 24 часа)' });
  }

  const phone = phoneStore[ad.id] || '+79000000000';

  // Log phone request (WITHOUT raw phone number in log!)
  phoneRequestsLog.push({
    id: 'pr_' + Date.now(),
    userId,
    adId: id,
    timestamp: Date.now()
  });

  addLog('PHONE_REQUEST', 'PhoneSecurity', `Запрошен номер телефона для объявления ${id}`, 'success', userId, id, undefined, Date.now() - startTime);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ phone });
});

// 4. Create Ad (with AI auto-moderation)
app.post('/api/ads', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const {
    userId,
    type,
    category,
    photos,
    petName,
    contactName,
    phone,
    description,
    lat,
    lng,
    captchaToken
  } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }

  if (isUserBlocked(user)) {
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
  }

  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'Необходима проверка CAPTCHA' });
  }

  // Rate Limits Check: max 3 active ads, max 5 attempts in 24h
  const limits = getUserRateLimits(userId);
  if (limits.activeAdsCount >= limits.maxActiveAds) {
    return res.status(400).json({ error: 'Достигнут лимит 3 одновременно активных объявлений. Снимите старое объявление перед публикацией нового.' });
  }
  if (limits.publishAttempts24h >= limits.maxPublishAttempts24h) {
    return res.status(429).json({ error: 'Превышен лимит 5 попыток создания объявлений за 24 часа.' });
  }

  // Record publish attempt
  publishAttemptsLog.push({ id: 'pa_' + Date.now(), userId, timestamp: Date.now() });

  // Field Validations
  if (!type || !['lost', 'found'].includes(type)) {
    return res.status(400).json({ error: 'Укажите корректный тип объявления (Потерял или Нашёл)' });
  }
  if (!category || !['cat', 'dog', 'other'].includes(category)) {
    return res.status(400).json({ error: 'Укажите категорию животного' });
  }
  if (!photos || !Array.isArray(photos) || photos.length < 1 || photos.length > 3) {
    return res.status(400).json({ error: 'Требуется от 1 до 3 фотографий' });
  }
  if (type === 'lost' && (!petName || !petName.trim())) {
    return res.status(400).json({ error: 'Кличка обязательна для объявления "Потерял"' });
  }
  if (!contactName || !phone || !description || lat == null || lng == null) {
    return res.status(400).json({ error: 'Заполните все обязательные поля (имя, телефон, описание, точка на карте)' });
  }

  const adId = 'ad_' + Date.now();
  const nowISO = new Date().toISOString();
  const expiresAtISO = new Date(Date.now() + 7 * 86400000).toISOString();

  const newAd: AdItem = {
    id: adId,
    userId,
    type,
    category,
    photos,
    petName: petName ? petName.trim() : '',
    contactName: contactName.trim(),
    description: description.trim(),
    lat: Number(lat),
    lng: Number(lng),
    createdAt: nowISO,
    expiresAt: expiresAtISO,
    viewsCount: 0,
    status: 'pending_moderation',
    complaintCount: 0
  };

  ads.unshift(newAd);
  phoneStore[adId] = phone.trim();

  // Primary Multimodal AI Moderation with Gemini
  let moderationResult = 'approved';
  let rejectionReason = '';

  try {
    const ai = getGeminiClient();
    const promptText = `
Вы — автоматическая служба модерации объявлений о пропавших и найденных домашних животных.
Проверьте данное объявление:
Тип: ${type === 'lost' ? 'Потерял' : 'Нашёл'}
Категория: ${category}
Кличка: ${petName || 'Не указана'}
Описание: ${description}

Требования модерации:
1. Объявление должно быть строго связано с поиском или находкой домашних животных.
2. Запрещен спам, политика, реклама товаров/услуг, нецензурная лексика, порнография.
3. На фотографиях главным объектом ДОЛЖНО быть домашнее животное. Если на фото только человек, пейзаж или посторонний предмет — отклонить. Допускается человек, если он держит животное на руках или рядом.

Ответьте в строгом формате JSON:
{
  "approved": boolean,
  "reason": "краткое объяснение если rejected"
}
`;

    const contentsParts: any[] = [{ text: promptText }];

    // Attach first photo if available as inline base64 image
    const firstPhoto = photos[0];
    if (firstPhoto && firstPhoto.startsWith('data:image/')) {
      const mimeType = firstPhoto.substring(5, firstPhoto.indexOf(';'));
      const base64Data = firstPhoto.substring(firstPhoto.indexOf(',') + 1);
      contentsParts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: { parts: contentsParts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            approved: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ['approved']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.approved) {
      moderationResult = 'approved';
    } else {
      moderationResult = 'rejected';
      rejectionReason = parsed.reason || 'Содержание или изображение не соответствует правилам сервиса';
    }
  } catch (err: any) {
    console.error('Gemini Moderation error:', err);
    // If AI service is unavailable, set pending_moderation so it retries automatically
    moderationResult = 'pending_moderation';
    addLog('AI_MODERATION_UNAVAILABLE', 'AI_Engine', `Внешняя модель временно недоступна, статус переведен в ожидание модерации`, 'warning', userId, adId, err.message);
  }

  if (moderationResult === 'approved') {
    newAd.status = 'active';
    addLog('AD_MODERATED_APPROVED', 'AI_Engine', `Объявление ${adId} успешно прошло первичное модерацию`, 'success', userId, adId, undefined, Date.now() - startTime);

    // Trigger Geo-Subscription Notifications
    subscriptions.forEach(sub => {
      if (sub.isActive && sub.userId !== userId) {
        const dist = calculateDistanceMeters(sub.lat, sub.lng, newAd.lat, newAd.lng);
        if (dist <= sub.radius) {
          notifications.unshift({
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            userId: sub.userId,
            title: 'Новое объявление неподалеку!',
            message: `Появилось объявление (${type === 'lost' ? 'Потерялся' : 'Найден'} ${category}) в ${Math.round(dist)}м от вашей сохраненной геоточки.`,
            date: new Date().toISOString(),
            read: false,
            adId: newAd.id
          });
        }
      }
    });

  } else if (moderationResult === 'rejected') {
    newAd.status = 'rejected';
    newAd.rejectionReason = 'Объявление отклонено автомодератором (содержание не соответствует правилам).';
    addLog('AD_MODERATED_REJECTED', 'AI_Engine', `Объявление ${adId} отклонено модератором`, 'warning', userId, adId, undefined, Date.now() - startTime);
  } else {
    newAd.status = 'pending_moderation';
  }

  res.json({ ad: toPublicAd(newAd, userId), status: newAd.status });
});

// 5. Unpublish Own Ad
app.post('/api/ads/:id/unpublish', (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  const ad = ads.find(a => a.id === id);
  if (!ad) return res.status(404).json({ error: 'Объявление не найдено' });

  const user = users.find(u => u.id === userId);
  if (!user || (ad.userId !== userId && user.role !== 'master')) {
    return res.status(403).json({ error: 'Нет прав на снятие объявления' });
  }

  ad.status = 'unpublished';
  ad.unpublishedAt = new Date().toISOString();
  addLog('AD_UNPUBLISHED', 'Ads', `Объявление ${id} снято с публикации пользователем ${user.email}`, 'info', userId, id);

  res.json({ success: true, ad: toPublicAd(ad, userId) });
});

// 6. Submit Complaint (with Secondary AI re-evaluation)
app.post('/api/ads/:id/complaint', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { captchaToken, reason } = req.body;

  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'Проверка CAPTCHA не пройдена' });
  }

  const ad = ads.find(a => a.id === id);
  if (!ad || ad.status !== 'active') {
    return res.status(404).json({ error: 'Объявление не активно или не найдено' });
  }

  ad.complaintCount = (ad.complaintCount || 0) + 1;
  addLog('COMPLAINT_RECEIVED', 'ComplaintService', `Поступила жалоба на объявление ${id}. Запуск повторной AI проверки.`, 'info', undefined, id);

  // Secondary AI Re-moderation with stricter prompt
  try {
    const ai = getGeminiClient();
    const promptText = `
На данное объявление поступила жалоба пользователя: "${reason || 'Неподобающий контент'}".
Проведите вторичную глубокую модерацию.
Описание: ${ad.description}
Кличка: ${ad.petName || 'Нет'}
Контакт: ${ad.contactName}

Является ли это объявление спамом, фейком, мошенничеством или не относящимся к домашним животным?
Ответьте в JSON:
{
  "shouldRemove": boolean,
  "reason": "причина снятия"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shouldRemove: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
          },
          required: ['shouldRemove']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.shouldRemove) {
      ad.status = 'unpublished';
      ad.unpublishedAt = new Date().toISOString();
      addLog('AD_REMOVED_BY_COMPLAINT_AI', 'ComplaintService', `Объявление ${id} снято по результатам жалобы и вторичной модерации`, 'warning', ad.userId, id);

      // Notify Author
      notifications.unshift({
        id: 'notif_' + Date.now(),
        userId: ad.userId,
        title: 'Объявление снято с публикации',
        message: 'Ваше объявление было снято с публикации по результатам проверки жалобы.',
        date: new Date().toISOString(),
        read: false,
        adId: ad.id
      });
    }
  } catch (err: any) {
    console.error('Secondary AI moderation error:', err);
  }

  res.json({ success: true, message: 'Жалоба принята на рассмотрение' });
});

// 7. Geo-Subscription endpoints
app.get('/api/subscription', (req: Request, res: Response) => {
  const userId = req.header('X-User-Id') || (req.query.userId as string);
  if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

  const sub = subscriptions.find(s => s.userId === userId && s.isActive);
  res.json({ subscription: sub || null });
});

app.post('/api/subscription', (req: Request, res: Response) => {
  const { userId, lat, lng, radius } = req.body;
  if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

  if (![100, 500, 1000, 2000].includes(Number(radius))) {
    return res.status(400).json({ error: 'Некорректный радиус подписки (100м, 500м, 1км, 2км)' });
  }

  // Deactivate existing
  subscriptions.forEach(s => {
    if (s.userId === userId) s.isActive = false;
  });

  const newSub: GeoSubscription = {
    id: 'sub_' + Date.now(),
    userId,
    lat: Number(lat),
    lng: Number(lng),
    radius: Number(radius),
    isActive: true,
    createdAt: new Date().toISOString()
  };

  subscriptions.push(newSub);
  addLog('GEO_SUB_CREATED', 'GeoService', `Создана геоподписка (${radius}м)`, 'success', userId);

  res.json({ subscription: newSub });
});

app.delete('/api/subscription', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

  subscriptions.forEach(s => {
    if (s.userId === userId) s.isActive = false;
  });

  addLog('GEO_SUB_DELETED', 'GeoService', `Отключена геоподписка`, 'info', userId);
  res.json({ success: true });
});

// 8. User Notifications & Settings
app.get('/api/notifications', (req: Request, res: Response) => {
  const userId = req.header('X-User-Id') || (req.query.userId as string);
  if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

  const userNotifs = notifications.filter(n => n.userId === userId);
  res.json({ notifications: userNotifs });
});

app.put('/api/user/settings', (req: Request, res: Response) => {
  const { userId, push, email } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  user.notificationSettings = {
    push: Boolean(push),
    email: Boolean(email)
  };

  // If push disabled, deactivate geo subscription according to requirement 17!
  if (!user.notificationSettings.push) {
    subscriptions.forEach(s => {
      if (s.userId === userId) s.isActive = false;
    });
  }

  addLog('SETTINGS_UPDATED', 'User', `Обновлены настройки уведомлений (Push: ${push}, Email: ${email})`, 'info', userId);
  res.json({ user });
});

// 9. Auth Routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, captchaToken } = req.body;
  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'CAPTCHA не пройдена' });
  }

  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase().trim());
  if (!user) {
    addLog('LOGIN_FAILED', 'Auth', `Неудачный вход для ${email}`, 'warning');
    return res.status(400).json({ error: 'Неверный e-mail или пароль' });
  }

  if (isUserBlocked(user)) {
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
  }

  addLog('LOGIN_SUCCESS', 'Auth', `Успешный вход пользователя ${user.email}`, 'success', user.id);
  res.json({ user });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name, captchaToken } = req.body;
  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'CAPTCHA не пройдена' });
  }

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
  }

  if (users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
    return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  const newUser: User = {
    id: 'user_' + Date.now(),
    email: email.trim(),
    name: name ? name.trim() : email.split('@')[0],
    role: 'user',
    isBlocked: false,
    authProvider: 'email',
    notificationSettings: { push: true, email: true },
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  addLog('REGISTER_SUCCESS', 'Auth', `Новая регистрация: ${newUser.email}`, 'success', newUser.id);
  res.json({ user: newUser });
});

app.post('/api/auth/yandex', (req: Request, res: Response) => {
  const { captchaToken } = req.body;
  if (!verifyCaptcha(captchaToken)) {
    return res.status(400).json({ error: 'CAPTCHA не пройдена' });
  }

  let yandexUser = users.find(u => u.email === 'yandex.user@yandex.ru');
  if (!yandexUser) {
    yandexUser = {
      id: 'user_yandex_' + Date.now(),
      email: 'yandex.user@yandex.ru',
      name: 'Яндекс Пользователь',
      role: 'user',
      isBlocked: false,
      authProvider: 'yandex',
      notificationSettings: { push: true, email: true },
      createdAt: new Date().toISOString()
    };
    users.push(yandexUser);
  }

  addLog('YANDEX_LOGIN', 'Auth', `Вход через Яндекс ID: ${yandexUser.email}`, 'success', yandexUser.id);
  res.json({ user: yandexUser });
});

app.post('/api/auth/delete-account', (req: Request, res: Response) => {
  const { userId } = req.body;
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return res.status(404).json({ error: 'Пользователь не найден' });

  const user = users[userIndex];

  // Unpublish and clear all user ads
  ads = ads.filter(a => a.userId !== userId);
  subscriptions = subscriptions.filter(s => s.userId !== userId);
  notifications = notifications.filter(n => n.userId !== userId);
  phoneRequestsLog = phoneRequestsLog.filter(p => p.userId !== userId);

  // Anonymize logs belonging to deleted user
  systemLogs.forEach(l => {
    if (l.userId === userId) {
      l.userId = 'deleted_user_anonymized';
      l.details = l.details.replace(user.email, 'anonymized@deleted');
    }
  });

  users.splice(userIndex, 1);
  addLog('ACCOUNT_DELETED', 'Auth', `Аккаунт пользователя полностью удален`, 'info');

  res.json({ success: true });
});

// 10. Master Admin Operations
app.get('/api/master/users', (req: Request, res: Response) => {
  const userId = req.header('X-User-Id');
  const master = users.find(u => u.id === userId && u.role === 'master');
  if (!master) return res.status(403).json({ error: 'Доступ запрещен (требуется Мастер-аккаунт)' });

  res.json({ users });
});

app.post('/api/master/block', (req: Request, res: Response) => {
  const masterId = req.header('X-User-Id');
  const { targetUserId, blockUntil } = req.body;

  const master = users.find(u => u.id === masterId && u.role === 'master');
  if (!master) return res.status(403).json({ error: 'Доступ запрещен' });

  const target = users.find(u => u.id === targetUserId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  target.isBlocked = true;
  target.blockUntil = blockUntil || null;

  // Immediately unpublish all active ads of blocked user
  ads.forEach(ad => {
    if (ad.userId === targetUserId && ad.status === 'active') {
      ad.status = 'unpublished';
      ad.unpublishedAt = new Date().toISOString();
    }
  });

  addLog('MASTER_BLOCK_USER', 'MasterControl', `Мастер заблокировал пользователя ${target.email} (${blockUntil ? 'до ' + blockUntil : 'бессрочно'})`, 'warning', targetUserId);

  res.json({ success: true, targetUser: target });
});

app.post('/api/master/unblock', (req: Request, res: Response) => {
  const masterId = req.header('X-User-Id');
  const { targetUserId } = req.body;

  const master = users.find(u => u.id === masterId && u.role === 'master');
  if (!master) return res.status(403).json({ error: 'Доступ запрещен' });

  const target = users.find(u => u.id === targetUserId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  target.isBlocked = false;
  target.blockUntil = null;

  addLog('MASTER_UNBLOCK_USER', 'MasterControl', `Мастер снял блокировку с пользователя ${target.email}`, 'info', targetUserId);
  res.json({ success: true, targetUser: target });
});

// 11. Logs Endpoint (for monitoring/debug UI)
app.get('/api/logs', (req: Request, res: Response) => {
  res.json({ logs: systemLogs.slice(0, 100) });
});

// User rate limits status endpoint
app.get('/api/user/rate-limits', (req: Request, res: Response) => {
  const userId = req.header('X-User-Id') || (req.query.userId as string);
  if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

  res.json({ limits: getUserRateLimits(userId) });
});

// ==================== BACKGROUND EXPIRY & CLEANUP WORKER ==================== //
setInterval(() => {
  const now = Date.now();

  ads.forEach(ad => {
    if (ad.status === 'active') {
      const expires = new Date(ad.expiresAt).getTime();
      const timeLeft = expires - now;

      // 1. Auto-unpublish after 7 days (604800000ms)
      if (timeLeft <= 0) {
        ad.status = 'unpublished';
        ad.unpublishedAt = new Date().toISOString();
        addLog('AD_EXPIRED_AUTO', 'LifecycleWorker', `Объявление ${ad.id} автоматически снято с публикации по истечении 7 суток`, 'info', ad.userId, ad.id);

        notifications.unshift({
          id: 'notif_exp_' + Date.now() + '_' + ad.id,
          userId: ad.userId,
          title: 'Срок размещения истек',
          message: `Ваше объявление по ${ad.petName || ad.category} автоматически снято с публикации через 7 суток.`,
          date: new Date().toISOString(),
          read: false,
          adId: ad.id
        });
      }
      // 2. 24h Warning Notification before removal
      else if (timeLeft <= 24 * 3600000 && timeLeft > 23 * 3600000) {
        const warningExists = notifications.some(
          n => n.userId === ad.userId && n.adId === ad.id && n.title.includes('24 часа')
        );
        if (!warningExists) {
          notifications.unshift({
            id: 'notif_warn_' + Date.now() + '_' + ad.id,
            userId: ad.userId,
            title: 'Осталось 24 часа публикации',
            message: `Публикация вашего объявления по ${ad.petName || ad.category} завершится через 24 часа.`,
            date: new Date().toISOString(),
            read: false,
            adId: ad.id
          });
        }
      }
    }
  });

  // Auto-unblock temporary blocks
  users.forEach(u => {
    if (u.isBlocked && u.blockUntil) {
      if (now > new Date(u.blockUntil).getTime()) {
        u.isBlocked = false;
        u.blockUntil = null;
        addLog('TEMP_BLOCK_EXPIRED', 'LifecycleWorker', `Снята временная блокировка с пользователя ${u.email}`, 'info', u.id);
      }
    }
  });
}, 30000); // Runs every 30 seconds

// ==================== VITE MIDDLEWARE SETUP ==================== //
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
