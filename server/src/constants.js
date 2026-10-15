export const GENDERS = ['male', 'female'];

export const INTERESTS = ['music', 'games', 'movies', 'sports', 'tech', 'other'];

export const REPORT_REASONS = ['spam', 'harassment', 'sexual', 'minor', 'hate', 'other'];

const ADJECTIVES = [
  'Нууцлаг', 'Сэргэлэн', 'Цоглог', 'Хөгжилтэй', 'Зоригтой', 'Ухаалаг', 'Тайван',
  'Сониуч', 'Эелдэг', 'Хурдан', 'Мөрөөдөмтгий', 'Гэгээлэг', 'Шаргуу', 'Дуулгавартай',
  'Аялагч', 'Шөнийн', 'Одны', 'Сарны', 'Салхин', 'Уулын',
];

const ANIMALS = [
  'Чоно', 'Үнэг', 'Ирвэс', 'Бүргэд', 'Шар шувуу', 'Тарвага', 'Хэрэм', 'Туулай',
  'Бар', 'Хун', 'Тогоруу', 'Халиун', 'Зараа', 'Зээр', 'Хулан', 'Шонхор', 'Янгир', 'Цох',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function randomNickname() {
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)} #${num}`;
}
