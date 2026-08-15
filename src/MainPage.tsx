import { useEffect } from 'react';
import {
  ArrowUpRight,
  BellRing,
  Check,
  ChevronDown,
  MapPinned,
  PawPrint,
  PlusCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import './main-page.css';

const pageTitle = 'LostHvost — поиск пропавших и найденных животных';
const pageDescription = 'LostHvost помогает искать пропавших домашних животных, сообщать о найденных питомцах и получать уведомления о новых объявлениях рядом.';

function setMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function setProperty(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function MainPage() {
  useEffect(() => {
    document.title = pageTitle;
    document.documentElement.lang = 'ru';
    setMeta('description', pageDescription);
    setProperty('og:title', pageTitle);
    setProperty('og:description', pageDescription);
    setProperty('og:type', 'website');
    setProperty('og:url', 'https://losthvost.ru/main');
    setProperty('og:image', 'https://losthvost.ru/losthvost.png');
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', pageTitle);
    setMeta('twitter:description', pageDescription);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://losthvost.ru/main';

    let schema = document.getElementById('losthvost-main-schema') as HTMLScriptElement | null;
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'losthvost-main-schema';
      schema.type = 'application/ld+json';
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': 'https://losthvost.ru/main#website',
          url: 'https://losthvost.ru/main',
          name: 'LostHvost',
          description: pageDescription,
          inLanguage: 'ru-RU',
        },
        {
          '@type': 'WebApplication',
          '@id': 'https://losthvost.ru/main#application',
          name: 'LostHvost',
          url: 'https://losthvost.ru/',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          description: 'Сервис поиска пропавших и найденных домашних животных.',
        },
      ],
    });

    const revealElements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let observer: IntersectionObserver | undefined;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealElements.forEach((element) => observer?.observe(element));
    }

    return () => observer?.disconnect();
  }, []);

  return (
    <div className="info-page">
      <header className="info-header info-enter info-enter-header">
        <a className="info-brand" href="/main" aria-label="LostHvost — на главную информационной страницы">
          <img src="/losthvost.png" alt="" width="44" height="44" />
          <span>
            <strong>LostHvost</strong>
            <small>помощь питомцам</small>
          </span>
        </a>
        <nav className="info-nav" aria-label="Навигация по странице">
          <a href="#features">Возможности</a>
          <a href="#how-it-works">Как это работает</a>
          <a href="#questions">Вопросы</a>
        </nav>
        <a className="info-header-button" href="/">
          Открыть карту <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className="info-hero" aria-labelledby="hero-title">
          <div className="info-hero-copy info-enter info-enter-copy">
            <p className="info-eyebrow"><PawPrint size={16} aria-hidden="true" /> Сервис поиска домашних животных</p>
            <h1 id="hero-title">Питомцы должны возвращаться домой</h1>
            <p className="info-hero-lead">LostHvost помогает быстро сообщить о пропаже, найти найденное животное и связаться с владельцем рядом с местом события.</p>
            <div className="info-actions">
              <a className="info-button info-button-primary" href="/">
                Найти животное <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <a className="info-button info-button-secondary" href="/#create">
                <PlusCircle size={18} aria-hidden="true" /> Подать объявление
              </a>
            </div>
            <ul className="info-hero-points" aria-label="Что можно сделать в LostHvost">
              <li><span>01</span> Разместить объявление на карте</li>
              <li><span>02</span> Получить уведомление о находке рядом</li>
              <li><span>03</span> Безопасно связаться с автором</li>
            </ul>
          </div>

          <div className="info-hero-visual info-enter info-enter-visual" aria-label="Иллюстрация карты LostHvost" role="img">
            <div className="map-surface">
              <div className="map-grid map-grid-one" />
              <div className="map-grid map-grid-two" />
              <div className="map-road map-road-one" />
              <div className="map-road map-road-two" />
              <div className="map-road map-road-three" />
              <div className="map-pin map-pin-red"><span /></div>
              <div className="map-pin map-pin-blue"><span /></div>
              <div className="map-pin map-pin-green"><span /></div>
              <div className="map-card map-card-top"><span className="map-card-dot map-card-dot-red" /><span>Пропала кошка</span><small>рядом с вами</small></div>
              <div className="map-card map-card-bottom"><span className="map-card-dot map-card-dot-blue" /><span>Найден пёс</span><small>сегодня, 10:24</small></div>
              <div className="map-compass">N</div>
            </div>
            <div className="info-hero-badge"><ShieldCheck size={19} aria-hidden="true" /><span><strong>Контакты защищены</strong><small>Данные открываются по запросу</small></span></div>
          </div>
        </section>

        <section className="info-trust-row" aria-label="Основные преимущества" data-reveal>
          <div><strong>Одна карта</strong><span>для пропавших и найденных питомцев</span></div>
          <div><strong>Геоподписка</strong><span>уведомления о новых объявлениях</span></div>
          <div><strong>Живое участие</strong><span>владельцев, соседей и волонтёров</span></div>
        </section>

        <section className="info-section" id="features" aria-labelledby="features-title">
          <div className="info-section-heading" data-reveal>
            <p className="info-kicker">Всё нужное — рядом</p>
            <h2 id="features-title">Инструменты, которые помогают действовать быстро</h2>
            <p>В первые часы после пропажи особенно важны точная информация и люди поблизости. LostHvost собирает их в одном месте.</p>
          </div>
          <div className="info-feature-grid">
            <article className="info-feature-card info-feature-card-green" data-reveal>
              <span className="info-icon"><MapPinned size={22} aria-hidden="true" /></span>
              <h3>Карта объявлений</h3>
              <p>Смотрите пропавших и найденных животных на карте, изучайте описание и ориентиры.</p>
              <a href="/">Перейти к карте <ArrowUpRight size={16} aria-hidden="true" /></a>
            </article>
            <article className="info-feature-card info-feature-card-yellow" data-reveal>
              <span className="info-icon"><BellRing size={22} aria-hidden="true" /></span>
              <h3>Уведомления рядом</h3>
              <p>Выберите район и радиус. Сервис сообщит о новых объявлениях, которые могут быть важны.</p>
              <a href="/">Настроить подписку <ArrowUpRight size={16} aria-hidden="true" /></a>
            </article>
            <article className="info-feature-card info-feature-card-blue" data-reveal>
              <span className="info-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
              <h3>Защита контактов</h3>
              <p>В объявлении можно рассказать о питомце, не публикуя номер телефона открыто.</p>
              <a href="/">Узнать больше <ArrowUpRight size={16} aria-hidden="true" /></a>
            </article>
          </div>
        </section>

        <section className="info-section info-how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="info-section-heading info-section-heading-wide" data-reveal>
            <p className="info-kicker">Три простых шага</p>
            <h2 id="how-title">Помощь начинается с одного объявления</h2>
          </div>
          <ol className="info-steps">
            <li data-reveal><span className="info-step-number">01</span><div><h3>Опишите ситуацию</h3><p>Укажите, пропал питомец или вы нашли его. Добавьте фото, приметы и точку на карте.</p></div></li>
            <li data-reveal><span className="info-step-number">02</span><div><h3>Поделитесь информацией</h3><p>Объявление появится на карте после проверки. Его можно отправить тем, кто живёт рядом.</p></div></li>
            <li data-reveal><span className="info-step-number">03</span><div><h3>Будьте на связи</h3><p>Следите за откликами и получайте уведомления, если рядом появится похожее объявление.</p></div></li>
          </ol>
        </section>

        <section className="info-audience" aria-labelledby="audience-title" data-reveal>
          <div className="info-audience-mark"><Search size={25} aria-hidden="true" /></div>
          <div><p className="info-kicker">Для тех, кому не всё равно</p><h2 id="audience-title">Владелец, сосед или волонтёр — помощь важна в любой роли</h2><p>Даже одна внимательная публикация может привести питомца домой. Расскажите о LostHvost в домовом чате или поделитесь объявлением с соседями.</p></div>
          <a className="info-button info-button-dark" href="/">Открыть LostHvost <ArrowUpRight size={18} aria-hidden="true" /></a>
        </section>

        <section className="info-section info-faq" id="questions" aria-labelledby="questions-title">
          <div className="info-section-heading" data-reveal>
            <p className="info-kicker">Коротко о главном</p>
            <h2 id="questions-title">Частые вопросы</h2>
          </div>
          <div className="info-faq-list">
            <details data-reveal><summary>Как разместить объявление о пропавшем животном?<ChevronDown size={19} aria-hidden="true" /></summary><p>Откройте карту LostHvost, войдите в профиль и нажмите «Подать объявление». Укажите тип объявления, добавьте фотографию и отметьте место на карте.</p></details>
            <details data-reveal><summary>Можно ли сообщить о найденном питомце?<ChevronDown size={19} aria-hidden="true" /></summary><p>Да. Выберите вариант «Я нашёл чужого питомца», добавьте фото и описание. Такая публикация поможет владельцу узнать животное и связаться с вами.</p></details>
            <details data-reveal><summary>Как получать новости по своему району?<ChevronDown size={19} aria-hidden="true" /></summary><p>В профиле включите геоподписку, выберите точку и радиус. Вы будете получать уведомления о новых объявлениях рядом.</p></details>
          </div>
        </section>

        <section className="info-final-cta" aria-labelledby="final-title" data-reveal>
          <div><p className="info-kicker">Начните сейчас</p><h2 id="final-title">Пусть следующий след приведёт домой</h2><p>Откройте карту LostHvost или расскажите о найденном животном — иногда помощь начинается с пары минут.</p></div>
          <div className="info-actions"><a className="info-button info-button-light" href="/">Открыть карту <ArrowUpRight size={18} aria-hidden="true" /></a><span className="info-final-note"><Check size={16} aria-hidden="true" /> Просто начать</span></div>
        </section>
      </main>

      <footer className="info-footer" data-reveal>
        <a className="info-brand" href="/main"><img src="/losthvost.png" alt="" width="36" height="36" /><span><strong>LostHvost</strong><small>поиск домашних животных</small></span></a>
        <p>Сервис, который помогает питомцам возвращаться домой.</p>
        <a href="/">Перейти к сервису <ArrowUpRight size={16} aria-hidden="true" /></a>
      </footer>
    </div>
  );
}
