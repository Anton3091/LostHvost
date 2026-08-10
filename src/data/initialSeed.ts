import { AdItem, User, GeoSubscription } from '../types';

export const SEED_USERS: User[] = [
  {
    id: 'user_master_1',
    email: 'master@petfinder.ru',
    name: 'Мастер-Администратор',
    role: 'master',
    avatarUrl: null,
    isBlocked: false,
    authProvider: 'email',
    notificationSettings: { push: false, email: false, telegram: false },
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'user_1',
    email: 'anna.smirnova@mail.ru',
    name: 'Анна Смирнова',
    role: 'user',
    avatarUrl: null,
    isBlocked: false,
    authProvider: 'email',
    notificationSettings: { push: false, email: false, telegram: false },
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 'user_2',
    email: 'dmitry.v@yandex.ru',
    name: 'Дмитрий Василенко',
    role: 'user',
    avatarUrl: null,
    isBlocked: false,
    authProvider: 'yandex',
    notificationSettings: { push: false, email: false, telegram: false },
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: 'user_3',
    email: 'elena.petrova@gmail.com',
    name: 'Елена Петрова',
    role: 'user',
    avatarUrl: null,
    isBlocked: false,
    authProvider: 'email',
    notificationSettings: { push: false, email: false, telegram: false },
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
  }
];

export const SEED_PHONES: Record<string, string> = {
  'ad_1': '+79161234567',
  'ad_2': '+79219876543',
  'ad_3': '+79031112233',
  'ad_4': '+79854445566',
  'ad_5': '+79998887766'
};

const NOW = Date.now();
const DAY = 86400000;

export const SEED_ADS: AdItem[] = [
  {
    id: 'ad_1',
    userId: 'user_1',
    type: 'lost',
    category: 'cat',
    photos: [
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=800&q=80'
    ],
    petName: 'Барсик',
    contactName: 'Анна',
    description: 'Рыжий пушистый кот, зелёные глаза, ошейник с бубенчиком. Выскочил из квартиры в районе Арбата.',
    lat: 55.751244,
    lng: 37.598418,
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    expiresAt: new Date(NOW + 5 * DAY).toISOString(),
    viewsCount: 42,
    status: 'active',
    complaintCount: 0
  },
  {
    id: 'ad_2',
    userId: 'user_2',
    type: 'found',
    category: 'dog',
    photos: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80'
    ],
    petName: '',
    contactName: 'Дмитрий',
    description: 'Найдена собака, похожа на золотистого ретривера. Очень добрый пёс, на шее потертый кожаный ошейник без жетона. Сидел около метро «Парк Культуры».',
    lat: 55.735150,
    lng: 37.593450,
    createdAt: new Date(NOW - 1 * DAY).toISOString(),
    expiresAt: new Date(NOW + 6 * DAY).toISOString(),
    viewsCount: 28,
    status: 'active',
    complaintCount: 0
  },
  {
    id: 'ad_3',
    userId: 'user_3',
    type: 'lost',
    category: 'dog',
    photos: [
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80'
    ],
    petName: 'Арчи',
    contactName: 'Елена',
    description: 'Французский бульдог, тигровый окрас, небольшое белое пятно на груди. Откликается на имя Арчи. Испугался салюта в парке Горького.',
    lat: 55.729800,
    lng: 37.601200,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    expiresAt: new Date(NOW + 4 * DAY).toISOString(),
    viewsCount: 75,
    status: 'active',
    complaintCount: 0
  },
  {
    id: 'ad_4',
    userId: 'user_1',
    type: 'found',
    category: 'cat',
    photos: [
      'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80'
    ],
    petName: '',
    contactName: 'Анна Смирнова',
    description: 'Найден молодой серый полосатый котик (британская вислоухая). Забежал в подъезд дома на Тверской.',
    lat: 55.764500,
    lng: 37.605100,
    createdAt: new Date(NOW - 12 * 3600000).toISOString(),
    expiresAt: new Date(NOW + 6.5 * DAY).toISOString(),
    viewsCount: 19,
    status: 'active',
    complaintCount: 0
  },
  {
    id: 'ad_5',
    userId: 'user_2',
    type: 'lost',
    category: 'other',
    photos: [
      'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80'
    ],
    petName: 'Кеша',
    contactName: 'Дмитрий В.',
    description: 'Улетел зелёный волнистый попугайчик Кеша. Откликается на свист. В районе Сокольников.',
    lat: 55.790500,
    lng: 37.678000,
    createdAt: new Date(NOW - 4 * DAY).toISOString(),
    expiresAt: new Date(NOW + 3 * DAY).toISOString(),
    viewsCount: 31,
    status: 'active',
    complaintCount: 0
  }
];

export const SEED_SUBSCRIPTIONS: GeoSubscription[] = [
  {
    id: 'sub_1',
    userId: 'user_1',
    lat: 55.751244,
    lng: 37.598418,
    radius: 1000,
    isActive: true,
    createdAt: new Date(NOW - 10 * DAY).toISOString()
  }
];
