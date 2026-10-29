// Ulaanbaatar is UTC+08:00. Opening belongs to the evening before midnight.
export function blindDateWindow(now = Date.now()) {
  const local = new Date(now + 8 * 3600000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 8 * 3600000;
  const hour = local.getUTCHours();
  const open = hour >= 20 || hour < 4;
  const startsAt = midnight + (hour < 4 ? -4 : 20) * 3600000;
  return { open, startsAt, endsAt: startsAt + 8 * 3600000, nextStartsAt: open ? startsAt + 24 * 3600000 : startsAt,
    timeZone: 'Asia/Ulaanbaatar', schedule: 'Өдөр бүр 20:00–04:00 · УБ цаг', serverNow: now };
}

export const BLIND_STAGES = ['icebreaker', 'text', 'voice', 'reveal', 'connect'];
export const DATE_QUESTIONS = [
  'Чиний төгс амралтын өдөр ямар байх вэ?',
  'Сүүлийн үед чамайг хамгийн их инээлгэсэн зүйл юу вэ?',
  'Хамт нэг газар аялж болох бол хаашаа явах вэ?',
  'Чамайг хамгийн сайн илэрхийлэх дуу аль вэ?',
];

export function sanitizeDateProfile(payload) {
  if (typeof payload.name !== 'string') return null;
  const name = payload.name.trim();
  if (!name || [...name].length > 40 || /[\p{Cc}\p{Cf}]/u.test(name)) return null;
  const photo = payload.photo || null;
  // Only bounded JPEG data, never arbitrary URLs or executable image formats.
  if (photo !== null && (typeof photo !== 'string' || photo.length > 120000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(photo))) return null;
  return { name, photo };
}
