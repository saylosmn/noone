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

export const DATE_QUESTIONS = [
  'Хүнээс хамгийн түрүүнд ямар зан чанарыг анзаардаг вэ?',
  'Чамд хамгийн үнэ цэнтэй дурсамж юу вэ?',
  'Шинээр сурахыг хүсдэг зүйл чинь юу вэ?',
  'Анхны болзоогоо хэрхэн төсөөлдөг вэ?',
  'Чиний төгс амралтын өдөр ямар байх вэ?',
  'Сүүлийн үед чамайг хамгийн их инээлгэсэн зүйл юу вэ?',
  'Хамт нэг газар аялж болох бол хаашаа явах вэ?',
  'Чамайг хамгийн сайн илэрхийлэх дуу аль вэ?',
];

