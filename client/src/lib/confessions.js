import { apiUrl } from './socket.js';
import { local } from './storage.js';

// Төхөөрөмжийн түр ID — like-ийг давхардуулахгүй, өөрийн бичсэнээ устгахад л ашиглана.
// Серверт зөвхөн hash нь хадгалагдана.
const DEVICE_KEY = 'noone.device';
export function deviceId() {
  let id = local.get(DEVICE_KEY, null);
  if (typeof id !== 'string' || !/^d_[a-f0-9]{32}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = `d_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    local.set(DEVICE_KEY, id);
  }
  return id;
}

export const CONFESSION_TAGS = [
  { id: 'love', label: 'Хайр дурлал', emoji: '💘' },
  { id: 'school', label: 'Сургууль', emoji: '🏫' },
  { id: 'funny', label: 'Инээдтэй', emoji: '😂' },
  { id: 'secret', label: 'Нууц', emoji: '🤫' },
  { id: 'sad', label: 'Гуниг', emoji: '🥀' },
  { id: 'question', label: 'Асуулт', emoji: '❓' },
];
export const tagInfo = (id) => CONFESSION_TAGS.find((t) => t.id === id) || CONFESSION_TAGS[3];

export const CONFESSION_REPORT_REASONS = [
  { id: 'personal_info', label: 'Бодит хүний нэр, хувийн мэдээлэл ил гаргасан' },
  { id: 'harassment', label: 'Доромжлол, гүтгэлэг, дарамт' },
  { id: 'sexual', label: 'Бэлгийн шинжтэй агуулга' },
  { id: 'minor', label: '18 нас хүрээгүй хүний тухай / бичсэн' },
  { id: 'hate', label: 'Үзэн ядалт, ялгаварлал' },
  { id: 'spam', label: 'Спам, зар сурталчилгаа' },
  { id: 'other', label: 'Бусад' },
];

export const CONFESSION_RULES = [
  'Бодит хүний нэр, утас, сошиал хаяг, гэрийн хаяг бүү бич.',
  'Хэн нэгнийг доромжлох, гүтгэх, заналхийлэхийг хориглоно.',
  'Бэлгийн шинжтэй, 18 нас хүрээгүй хүний тухай агуулга хориотой.',
  '3 хүн мэдээлбэл автоматаар нуугдана. 30 хоногийн дараа устна.',
];

export const CONFESSION_LIMITS = { min: 10, max: 500 };

const ERRORS = {
  contact_info: 'Утас, линк, @хаяг, имэйл зэрэг холбоо барих мэдээлэл бичих боломжгүй.',
  too_short: `Хамгийн багадаа ${CONFESSION_LIMITS.min} тэмдэгт бичнэ үү.`,
  too_long: `Хамгийн ихдээ ${CONFESSION_LIMITS.max} тэмдэгт.`,
  empty: 'Юу ч бичээгүй байна.',
  duplicate: 'Яг ийм confession саяхан нийтлэгдсэн байна.',
  adult_confirmation_required: '18 нас хүрсэн гэдгээ баталгаажуулна уу.',
  no_device: 'Хөтчийн хадгалалт хаалттай байна. Хувийн цонхноос гарч оролдоно уу.',
  not_found: 'Энэ confession устсан эсвэл нуугдсан байна.',
  own_post: 'Өөрийнхөө бичсэнийг мэдээлэх боломжгүй.',
  forbidden: 'Зөвхөн өөрийнхөө бичсэнийг устгана.',
  loading: 'Сервер сэрж байна. Түр хүлээгээд дахин оролдоно уу.',
  network: 'Сервертэй холбогдож чадсангүй. Холболтоо шалгана уу.',
};

export function confessionError(code, retryAfterMs) {
  if (code === 'rate_limited') {
    const min = Math.ceil((retryAfterMs || 60000) / 60000);
    return `Хэт олон удаа илгээлээ. ${min} минутын дараа дахин оролдоно уу.`;
  }
  return ERRORS[code] || 'Алдаа гарлаа. Дахин оролдоно уу.';
}

export class ApiError extends Error {
  constructor(code, retryAfterMs) {
    super(confessionError(code, retryAfterMs));
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 70000 } = {}) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/confessions${path}`), {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Noone-Device': deviceId() },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'server_error', data.retryAfterMs);
  return data;
}

export const confessionsApi = {
  list: ({ sort = 'new', tag, school, offset = 0 } = {}) => {
    const q = new URLSearchParams({ sort, offset: String(offset) });
    if (tag) q.set('tag', tag);
    if (school) q.set('school', school);
    return request(`?${q}`);
  },
  get: (id) => request(`/${encodeURIComponent(id)}`),
  create: (payload) => request('', { method: 'POST', body: payload }),
  like: (id, like) => request(`/${encodeURIComponent(id)}/like`, { method: 'POST', body: { like } }),
  report: (id, reason) => request(`/${encodeURIComponent(id)}/report`, { method: 'POST', body: { reason } }),
  remove: (id) => request(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'саяхан';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  return `${d} өдөр`;
}

export const confessionPath = (id) => `/hana/${id}`;
export const confessionUrl = (id) => `${window.location.origin}${confessionPath(id)}`;
