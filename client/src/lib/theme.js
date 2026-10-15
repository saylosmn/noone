import { local } from './storage.js';

// Accent өнгөнүүд. on = товч дээрх текстийн өнгө (contrast-ийн дагуу).
export const ACCENTS = [
  { id: 'pink', label: 'Ягаан', color: '#ff3d8b', light: '#ff6aa8', alt: '#4d8bff', rgb: '255, 61, 139', on: '#ffffff' },
  { id: 'blue', label: 'Цэнхэр', color: '#3b82f6', light: '#6aa2ff', alt: '#22d3ee', rgb: '59, 130, 246', on: '#ffffff' },
  { id: 'violet', label: 'Нил ягаан', color: '#a855f7', light: '#c084fc', alt: '#ec4899', rgb: '168, 85, 247', on: '#ffffff' },
  { id: 'green', label: 'Ногоон', color: '#22c55e', light: '#4ade80', alt: '#14b8a6', rgb: '34, 197, 94', on: '#052e14' },
  { id: 'orange', label: 'Улбар шар', color: '#ff8a1f', light: '#ffa95c', alt: '#ffd23d', rgb: '255, 138, 31', on: '#2a1300' },
  { id: 'red', label: 'Улаан', color: '#f43f5e', light: '#fb7185', alt: '#fb923c', rgb: '244, 63, 94', on: '#ffffff' },
  { id: 'cyan', label: 'Цэнхэр ногоон', color: '#06b6d4', light: '#22d3ee', alt: '#818cf8', rgb: '6, 182, 212', on: '#022c33' },
];

// Суурь (дэвсгэр) өнгө — бүгд dark.
export const BACKGROUNDS = [
  { id: 'navy', label: 'Гүн хөх', swatch: '#0b1124', meta: '#070b16' },
  { id: 'black', label: 'Хар', swatch: '#0d0d10', meta: '#060607' },
  { id: 'plum', label: 'Шөнийн нил', swatch: '#150d24', meta: '#0c0716' },
  { id: 'forest', label: 'Гүн ногоон', swatch: '#0a1712', meta: '#050d0a' },
];

const KEY = 'noone.settings';

export function applyTheme(accentId, bgId) {
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const bg = BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS[0];
  const root = document.documentElement;
  root.dataset.bg = bg.id;
  root.style.setProperty('--accent', accent.color);
  root.style.setProperty('--accent-2', accent.light);
  root.style.setProperty('--accent-alt', accent.alt);
  root.style.setProperty('--accent-rgb', accent.rgb);
  root.style.setProperty('--on-accent', accent.on);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg.meta);
}

/** Анх ачаалахад "flash" гаргахгүйн тулд render-ээс өмнө дуудна. */
export function applySavedTheme() {
  const s = local.get(KEY, {});
  applyTheme(s.accent, s.background);
}
