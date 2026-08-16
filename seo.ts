export type SeoAd = {
  id: string;
  type: 'lost' | 'found';
  category: 'cat' | 'dog' | 'other';
  petName?: string | null;
  city?: string | null;
};

type City = { name: string; lat: number; lng: number; radiusKm: number };

const cities: City[] = [
  { name: 'Москва', lat: 55.7558, lng: 37.6173, radiusKm: 75 },
  { name: 'Санкт-Петербург', lat: 59.9343, lng: 30.3351, radiusKm: 55 },
  { name: 'Новосибирск', lat: 55.0084, lng: 82.9357, radiusKm: 40 },
  { name: 'Екатеринбург', lat: 56.8389, lng: 60.6057, radiusKm: 40 },
  { name: 'Казань', lat: 55.7961, lng: 49.1064, radiusKm: 40 },
  { name: 'Нижний Новгород', lat: 56.3269, lng: 44.0059, radiusKm: 40 },
  { name: 'Челябинск', lat: 55.1644, lng: 61.4368, radiusKm: 40 },
  { name: 'Самара', lat: 53.1959, lng: 50.1002, radiusKm: 40 },
  { name: 'Омск', lat: 54.9885, lng: 73.3242, radiusKm: 40 },
  { name: 'Ростов-на-Дону', lat: 47.2357, lng: 39.7015, radiusKm: 40 },
  { name: 'Уфа', lat: 54.7388, lng: 55.9721, radiusKm: 40 },
  { name: 'Красноярск', lat: 56.0153, lng: 92.8932, radiusKm: 40 },
  { name: 'Воронеж', lat: 51.6608, lng: 39.2003, radiusKm: 35 },
  { name: 'Пермь', lat: 58.0105, lng: 56.2502, radiusKm: 35 },
  { name: 'Волгоград', lat: 48.708, lng: 44.5133, radiusKm: 40 },
  { name: 'Краснодар', lat: 45.0355, lng: 38.9753, radiusKm: 40 },
  { name: 'Саратов', lat: 51.5336, lng: 46.0343, radiusKm: 35 },
  { name: 'Тюмень', lat: 57.1529, lng: 65.5272, radiusKm: 35 },
  { name: 'Ижевск', lat: 56.8527, lng: 53.2115, radiusKm: 35 },
  { name: 'Барнаул', lat: 53.3481, lng: 83.7798, radiusKm: 35 },
  { name: 'Иркутск', lat: 52.2864, lng: 104.2807, radiusKm: 35 },
  { name: 'Хабаровск', lat: 48.4802, lng: 135.0719, radiusKm: 35 },
  { name: 'Владивосток', lat: 43.1155, lng: 131.8855, radiusKm: 35 },
  { name: 'Ярославль', lat: 57.6261, lng: 39.8845, radiusKm: 35 },
  { name: 'Калининград', lat: 54.7104, lng: 20.4522, radiusKm: 35 },
  { name: 'Сочи', lat: 43.5855, lng: 39.7231, radiusKm: 35 }
];

const cyrillicToLatin: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

const categoryName = (category: SeoAd['category']) => ({ cat: 'кот', dog: 'пёс', other: 'питомец' }[category]);

export const adSeoAction = (type: SeoAd['type']) => type === 'lost' ? 'Потерян' : 'Найден';

export function adSeoSubject(ad: SeoAd) {
  const name = String(ad.petName || '').trim();
  return name ? `${categoryName(ad.category)} ${name}` : categoryName(ad.category);
}

export function adSeoTitle(ad: SeoAd) {
  const city = String(ad.city || '').trim();
  return `${adSeoAction(ad.type)} ${adSeoSubject(ad)}${city ? `, ${city}` : ''} — LostHvost`;
}

export function slugify(value: string) {
  const latin = value.toLowerCase().replace(/[а-яё]/g, letter => cyrillicToLatin[letter] || '');
  return latin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'obyavlenie';
}

export function adSeoPath(ad: SeoAd) {
  const city = String(ad.city || '').trim();
  return `/obyavleniya/${encodeURIComponent(ad.id)}/${slugify(`${adSeoAction(ad.type)} ${adSeoSubject(ad)} ${city}`)}`;
}

export function mainSeoSchema() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://losthvost.ru/main#website',
        url: 'https://losthvost.ru/main',
        name: 'LostHvost',
        alternateName: ['Лостхвост', 'Лост Хвост', 'Lost Hvost'],
        description: 'LostHvost — поиск пропавших и найденных домашних животных. Размещайте объявления и находите питомцев на карте.',
        inLanguage: 'ru-RU',
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://losthvost.ru/main#application',
        name: 'LostHvost',
        url: 'https://losthvost.ru/main',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        description: 'Сервис поиска пропавших и найденных домашних животных.',
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://losthvost.ru/main#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Как разместить объявление о пропавшем животном?',
            acceptedAnswer: { '@type': 'Answer', text: 'Откройте карту LostHvost, войдите в профиль и нажмите «Подать объявление». Укажите тип объявления, добавьте фотографию и отметьте место на карте.' },
          },
          {
            '@type': 'Question',
            name: 'Можно ли сообщить о найденном питомце?',
            acceptedAnswer: { '@type': 'Answer', text: 'Да. Выберите вариант «Я нашёл чужого питомца», добавьте фото и описание. Такая публикация поможет владельцу узнать животное и связаться с вами.' },
          },
          {
            '@type': 'Question',
            name: 'Как получать новости по своему району?',
            acceptedAnswer: { '@type': 'Answer', text: 'В профиле включите геоподписку, выберите точку и радиус. Вы будете получать уведомления о новых объявлениях рядом.' },
          },
          {
            '@type': 'Question',
            name: 'Как найти пропавшее животное?',
            acceptedAnswer: { '@type': 'Answer', text: 'Откройте карту LostHvost и изучите объявления рядом с местом пропажи. Если питомца ещё нет на карте, разместите объявление с фотографией, приметами и точкой события.' },
          },
          {
            '@type': 'Question',
            name: 'Сколько стоит пользоваться LostHvost?',
            acceptedAnswer: { '@type': 'Answer', text: 'LostHvost бесплатен для владельцев, соседей и волонтёров. Размещение объявлений, поиск на карте и уведомления о новых объявлениях доступны без оплаты.' },
          },
        ],
      },
    ],
  }).replace(/</g, '\\u003c');
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * radians / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lng2 - lng1) * radians / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function cityForCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const matched = cities
    .map(city => ({ city, distance: distanceKm(lat, lng, city.lat, city.lng) }))
    .filter(({ city, distance }) => distance <= city.radiusKm)
    .sort((a, b) => a.distance - b.distance)[0];
  return matched?.city.name || '';
}
