import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const bottomNav = readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
const wizard = readFileSync(new URL('../src/components/CreateAdWizard.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const mainPageCss = readFileSync(new URL('../src/main-page.css', import.meta.url), 'utf8');
const legalCss = readFileSync(new URL('../public/legal.css', import.meta.url), 'utf8');
const privacyPage = readFileSync(new URL('../public/privacy/index.html', import.meta.url), 'utf8');

test('интерфейс использует основные токены брендбука', () => {
  assert.match(css, /--brand-primary:\s*#126e4a/);
  assert.match(css, /--ink-900:\s*#101614/);
  assert.match(css, /--canvas:\s*#f5f7f5/);
  assert.match(css, /--status-lost:\s*#b4471f/);
  assert.match(css, /--status-found:\s*#1f5fd0/);
});

test('шрифты дизайн-системы поставляются локально', () => {
  assert.equal(existsSync(new URL('../public/fonts/golos-text-cyrillic.woff2', import.meta.url)), true);
  assert.equal(existsSync(new URL('../public/fonts/jetbrains-mono-cyrillic.woff2', import.meta.url)), true);
  assert.match(css, /font-family:\s*"Golos Text"/);
  assert.match(css, /font-family:\s*"JetBrains Mono"/);
});

test('макет сохраняет настоящий логотип и юридические ссылки', () => {
  assert.match(bottomNav, /const appIcon = '\/losthvost\.png'/);
  assert.match(app, /LEGAL_DOCUMENT_PATHS\.privacy/);
  assert.match(app, /LEGAL_DOCUMENT_PATHS\.terms/);
  assert.match(app, /className="app-legal-footer/);
});

test('юридические страницы используют дизайн-систему без изменения текста', () => {
  assert.match(legalCss, /background:\s*#f5f7f5/);
  assert.match(legalCss, /border:\s*1px solid #e6eae7/);
  assert.match(privacyPage, /<link rel="stylesheet" href="\/legal\.css">/);
  assert.match(privacyPage, /<img src="\/losthvost\.png"/);
  assert.match(privacyPage, /Болятко Антон Сергеевич/);
});

test('страница main исключена из редизайна', () => {
  assert.match(mainPageCss, /--info-ink:\s*#17352a/);
  assert.match(mainPageCss, /font-family:\s*Inter/);
});

test('в выборе типа и категории нет эмодзи', () => {
  assert.doesNotMatch(wizard, /[🔍🏠🐱🐶🐾📍]/u);
  assert.match(wizard, /const categoryOptions/);
  assert.match(wizard, /aria-pressed=\{category === id\}/);
});

test('мобильная навигация повторяет плавающую панель макета', () => {
  assert.match(css, /\.app-bottom-nav \{[\s\S]*bottom: calc\(26px \+ env\(safe-area-inset-bottom\)\);[\s\S]*height: 64px;[\s\S]*border-radius: 24px;/);
  assert.match(css, /\.app-create-button \{[\s\S]*width: 60px;[\s\S]*height: 60px;[\s\S]*border-radius: 22px;/);
});

test('длинные шаги объявления открываются на весь мобильный экран', () => {
  assert.match(wizard, /step >= 3 \? 'wizard-modal--full'/);
  assert.match(wizard, /step >= 3 \? 'wizard-sheet--full'/);
  assert.match(css, /\.wizard-sheet--full \{[\s\S]*height: 100dvh;[\s\S]*border-radius: 0;/);
});
