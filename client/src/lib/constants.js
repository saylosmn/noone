export const INTERESTS = [
  { id: 'music', label: 'Хөгжим', emoji: '🎵' },
  { id: 'cs2', label: 'CS GO 2', emoji: '🎯' },
  { id: 'sports', label: 'Спорт', emoji: '⚽' },
  { id: 'tech', label: 'Технологи', emoji: '💻' },
  { id: 'other', label: 'Бусад', emoji: '✨' },
];

export const interestLabel = (id) => INTERESTS.find((i) => i.id === id)?.label ?? id;

export const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

export const CONTACT_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', placeholder: '@username', url: (h) => `https://instagram.com/${h.replace(/^@/, '')}` },
  { id: 'telegram', label: 'Telegram', placeholder: '@username', url: (h) => `https://t.me/${h.replace(/^@/, '')}` },
  { id: 'facebook', label: 'Facebook', placeholder: 'Нэр эсвэл username', url: null },
  { id: 'snapchat', label: 'Snapchat', placeholder: 'username', url: (h) => `https://www.snapchat.com/add/${h.replace(/^@/, '')}` },
  { id: 'discord', label: 'Discord', placeholder: 'username', url: null },
  { id: 'steam', label: 'Steam', placeholder: 'Steam нэр эсвэл ID', url: null },
];
export const platformLabel = (id) => CONTACT_PLATFORMS.find((p) => p.id === id)?.label ?? id;

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
  'Утас, гэрийн хаяг, байршлаа бүү бич. Хүсвэл “Найз болох”-оор хоёулаа зөвшөөрч сошиал хаягаа солилц.',
  'Хараалын үг автоматаар *** болж харагдана.',
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
  rate_limited: 'Түр хүлээнэ үү.',
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
  invalid_handle: 'Хаяг буруу байна (2–50 тэмдэгт).',
  invalid_platform: 'Сошиал сүлжээгээ сонгоно уу.',
  already_revealed: 'Та хоёр аль хэдийн хаягаа солилцсон.',
};

export const errorText = (code) => ERROR_TEXT[code] || 'Алдаа гарлаа. Дахин оролдоно уу.';

export const MAX_MESSAGE_LENGTH = 1000;

// Нөгөө хүн үргэлж ингэж харагдана (нэр сонгохгүй)
export const PARTNER_NAME = 'Нууц нэгэн';

// Спамын хязгаар (сервертэй ижил): 10 мессеж дараалан, дараа нь секундэд 3.
// Давбал 3 секунд "Түр хүлээнэ үү" гэж харуулна.
export const SPAM_LIMIT = { burst: 10, perSecond: 3, cooldownMs: 3000 };
