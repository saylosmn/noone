/**
 * Хараалын үг шүүлтүүр. Үгийн эхний үсгийг үлдээгээд бусдыг "*" болгоно.
 * prefix: тухайн үндэсээр эхэлсэн бүх үг, whole: яг тэр үг.
 */
const PREFIX = [
  // Монгол (кирилл)
  'пизд', 'пзд', 'новш', 'гичий', 'янхан', 'бля', 'ебат', 'ебал', 'ебан', 'ёбан', 'хуйн', 'хуйг', 'хуйл',
  // Монгол (латин)
  'pizd', 'pzd', 'novsh', 'gichii', 'yanhan', 'blya', 'blyat',
  // Англи
  'fuck', 'motherf', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'slut', 'whore', 'nigg', 'faggot',
];
const WHOLE = ['хуй', 'сука', 'суки', 'huy', 'hui', 'suka', 'dick', 'fck', 'fk', 'wtf'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(?:${PREFIX.map(escape).join('|')})[\\p{L}]*|(?:${WHOLE.map(escape).join('|')})(?![\\p{L}\\p{N}]))`,
  'giu',
);

export function maskProfanity(text) {
  let changed = false;
  const out = text.replace(pattern, (word) => {
    changed = true;
    const chars = [...word];
    return chars[0] + '*'.repeat(chars.length - 1);
  });
  return { text: out, changed };
}
