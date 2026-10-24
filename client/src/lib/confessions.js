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

export const CONFESSION_LIMITS = { min: 1, max: 1000 };
// Серверийн CONFESSION_IMAGE_MAX_BYTES-тэй таарна
const IMAGE_MAX_BYTES = 330 * 1024;
const IMAGE_MAX_SIDE = 1280;

const ERRORS = {
  contact_info: 'Утас, линк, @хаяг, имэйл зэрэг холбоо барих мэдээлэл бичих боломжгүй.',
  too_short: `Хамгийн багадаа ${CONFESSION_LIMITS.min} тэмдэгт бичнэ үү.`,
  bad_image: 'Зураг уншигдсангүй. Өөр зураг сонгоно уу.',
  image_too_large: 'Зураг хэт том байна. Өөр зураг сонгоно уу.',
  storage: 'Серверт хадгалж чадсангүй. Дахин оролдоно уу.',
  invalid_subscription: 'Энэ төхөөрөмж мэдэгдэл хүлээн авах боломжгүй байна.',
  too_long: `Хамгийн ихдээ ${CONFESSION_LIMITS.max} тэмдэгт.`,
  empty: 'Юм бичих эсвэл зураг сонгоно уу.',
  duplicate: 'Яг ийм confession саяхан нийтлэгдсэн байна.',
  adult_confirmation_required: '18 нас хүрсэн гэдгээ баталгаажуулна уу.',
  no_device: 'Хөтчийн хадгалалт хаалттай байна. Хувийн цонхноос гарч оролдоно уу.',
  not_found: 'Энэ confession устсан эсвэл нуугдсан байна.',
  own_post: 'Өөрийнхөө бичсэнийг мэдээлэх боломжгүй.',
  forbidden: 'Зөвхөн өөрийнхөө бичсэнийг устгана.',
  banned: 'Дүрэм зөрчсөн тул танд түр хугацаанд бичих эрх хаагдсан байна.',
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
  subscribe: (subscription) => request('/subscribe', { method: 'POST', body: { subscription } }),
  unsubscribe: () => request('/subscribe', { method: 'DELETE' }),
};

export const imageUrl = (id) => apiUrl(`/api/confessions/${encodeURIComponent(id)}/image`);

/**
 * Сонгосон зургийг JPEG болгон шахна (canvas дахин зурдаг тул EXIF/байршил арилна).
 * @returns {Promise<{ data: string, w: number, h: number, previewUrl: string }>}
 */
export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new ApiError('bad_image');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ApiError('bad_image');
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG-ийн тунгалаг хэсэг хар болохоос сэргийлнэ
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
  let blob = null;
  for (const q of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
    blob = await toBlob(q);
    if (blob && blob.size <= IMAGE_MAX_BYTES) break;
  }
  if (!blob || blob.size > IMAGE_MAX_BYTES) throw new ApiError('image_too_large');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(binary), w, h, previewUrl: URL.createObjectURL(blob) };
}

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
