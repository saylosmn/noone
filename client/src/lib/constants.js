export const INTERESTS = [
  { id: 'music', label: 'Хөгжим', emoji: '🎵' },
  { id: 'games', label: 'Тоглоом', emoji: '🎮' },
  { id: 'movies', label: 'Кино', emoji: '🎬' },
  { id: 'sports', label: 'Спорт', emoji: '⚽' },
  { id: 'tech', label: 'Технологи', emoji: '💻' },
  { id: 'other', label: 'Бусад', emoji: '✨' },
];

export const interestLabel = (id) => INTERESTS.find((i) => i.id === id)?.label ?? id;

export const GENDERS = [
  { id: 'male', label: 'Эрэгтэй', symbol: '♂' },
  { id: 'female', label: 'Эмэгтэй', symbol: '♀' },
];

export const REPORT_REASONS = [
  { id: 'spam', label: 'Спам, зар сурталчилгаа' },
  { id: 'harassment', label: 'Доромжлол, дарамт' },
  { id: 'sexual', label: 'Хүсээгүй бэлгийн шинжтэй агуулга' },
  { id: 'minor', label: '18 нас хүрээгүй байж магадгүй' },
  { id: 'hate', label: 'Үзэн ядалт, ялгаварлал' },
  { id: 'other', label: 'Бусад' },
];

export const RULES = [
  'Бусдыг хүндэтгэ — доромжлол, дарамт, заналхийлэл хориотой.',
  'Хүсээгүй хүнд бэлгийн шинжтэй зүйл бүү бич.',
  'Өөрийн болон бусдын хувийн мэдээлэл (утас, хаяг, байршил) бүү хуваалц.',
  'Спам, зар сурталчилгаа, луйвар хориотой.',
  'Зохисгүй зан гаргавал “Мэдээлэх”, “Блоклох” товчийг ашигла.',
];

export const ENDED_TEXT = {
  partner_left: 'Нөгөө хүн чатыг орхилоо.',
  partner_disconnected: 'Нөгөө хүний холболт тасарлаа.',
  you_left: 'Та чатыг дуусгалаа.',
  you_blocked: 'Та энэ хүнийг блоклолоо. Дахин тааралдахгүй.',
  you_reported: 'Мэдээлэл илгээгдлээ. Энэ хүн блоклогдож, дахин тааралдахгүй.',
  connection_lost: 'Таны холболт удаан тасарсан тул чат дууслаа.',
};

export const ERROR_TEXT = {
  rate_limited: 'Хэт хурдан байна. Түр хүлээгээд дахин оролдоно уу.',
  duplicate: 'Ижил мессежийг дахин дахин илгээхгүй байна уу.',
  partner_offline: 'Нөгөө хүн түр салсан тул мессеж илгээгдсэнгүй.',
  too_long: 'Мессеж хэт урт байна.',
  empty: 'Хоосон мессеж илгээх боломжгүй.',
  not_in_chat: 'Чат аль хэдийн дууссан байна.',
  restricted: 'Таны эсрэг олон мэдээлэл ирсэн тул түр хугацаанд чатлах боломжгүй.',
  adult_confirmation_required: '18 нас хүрсэн гэдгээ баталгаажуулна уу.',
  invalid_gender: 'Хүйсээ сонгоно уу.',
  already_chatting: 'Та аль хэдийн чатлаж байна.',
  no_partner: 'Мэдээлэх хүн олдсонгүй.',
  timeout: 'Сервер хариу өгсөнгүй. Холболтоо шалгана уу.',
  offline: 'Сервертэй холбогдоогүй байна.',
  server_error: 'Серверт алдаа гарлаа. Дахин оролдоно уу.',
  no_session: 'Сесс шинэчлэгдэж байна. Дахин оролдоно уу.',
};

export const errorText = (code) => ERROR_TEXT[code] || 'Алдаа гарлаа. Дахин оролдоно уу.';

export const MAX_MESSAGE_LENGTH = 1000;
