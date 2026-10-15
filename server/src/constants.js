export const GENDERS = ['male', 'female'];

export const INTERESTS = ['music', 'cs2', 'sports', 'tech', 'other'];

export const REPORT_REASONS = ['spam', 'harassment', 'sexual', 'minor', 'hate', 'other'];

// Хэрэглэгч нэр сонгохгүй — нөгөө хүнд үргэлж ингэж харагдана.
export const PARTNER_NAME = 'Нууц нэгэн';

// Сургууль (заавал биш) — ижил сургуулийнхныг түрүүлж холбоно
// "must-xxx" нь ШУТИС-ийн салбар сургууль. Нэг салбар = 3 оноо, ШУТИС-ийн өөр салбар = 2 оноо.
export const SCHOOLS = [
  'must', 'must-bas', 'must-nhus', 'must-hhuds', 'must-guus', 'must-mhts',
  'must-ehs', 'must-mts', 'must-hshus', 'must-ms', 'must-ghs',
  'num', 'ufe', 'mnums', 'msue', 'muls',
  'otgontenger', 'ikhzasag', 'mandakh', 'huree', 'ubis', 'other',
];

/** Хоёр сургуулийн ижил хэсгийг буцаана: { id, score } эсвэл null */
export function sharedSchool(a, b) {
  if (!a || !b || a === 'other' || b === 'other') return null;
  if (a === b) return { id: a, score: 3 };
  const ga = a.split('-')[0];
  const gb = b.split('-')[0];
  return ga === gb ? { id: ga, score: 2 } : null;
}

// Стикерүүдийн id (зураг нь клиент дээр)
export const STICKERS = [
  'hi', 'haha', 'love', 'sad', 'wow', 'cool', 'sleepy', 'angry', 'think', 'thanks', 'gg', 'bye',
  'yes', 'no', 'okay', 'sorry', 'shy', 'kiss', 'hungry', 'party', 'night', 'omg', 'dead', 'fire',
];

export const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

// "Найз болох" — харилцан зөвшөөрөлтэй үед л солилцоно
export const CONTACT_PLATFORMS = ['instagram', 'telegram', 'facebook', 'snapchat', 'discord', 'steam'];
