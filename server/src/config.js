import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const list = (value, fallback) =>
  (value ?? fallback)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

export function loadConfig(overrides = {}) {
  const env = process.env;
  const base = {
    port: int(env.PORT, 4000),
    // Frontend-ийн хаягууд (CORS). Таслалаар тусгаарлана.
    clientOrigins: list(env.CLIENT_ORIGIN, 'http://localhost:5173,http://127.0.0.1:5173'),
    // *.vercel.app preview хаягуудыг зөвшөөрөх эсэх (true бол vercel.app домэйнээс ирсэн бүх хүсэлт)
    allowVercelPreviews: env.ALLOW_VERCEL_PREVIEWS === 'true',
    // Ижил сонирхолтой хүн хүлээх хугацаа. Дараа нь хэнтэй ч хамаагүй холбоно.
    interestWaitMs: int(env.INTEREST_WAIT_MS, 6000),
    // Холболт тасарсны дараа чатыг хэр удаан хадгалах (дахин холбогдох боломж)
    reconnectGraceMs: int(env.RECONNECT_GRACE_MS, 15 * 60 * 1000),
    // Нөгөө хүн хэр удаан алга болсны дараа "гарсан эсвэл холболт нь тасарсан" гэж мэдэгдэх
    partnerAwayNoticeMs: int(env.PARTNER_AWAY_NOTICE_MS, 2 * 60 * 1000),
    // Push мэдэгдэлтэй хэрэглэгч апп-аа хаасан/нуусан үед чатыг хэр удаан хүлээх
    pushGraceMs: int(env.PUSH_GRACE_MS, 5 * 60 * 1000),
    // Нөгөө хүн түр гарсан үед хүргэгдээгүй мессежийг санах ойд хэдийг хүртэл барих
    pendingMax: int(env.PENDING_MAX, 100),
    // Саяхан ярьсан хүнтэй дахин холбохгүй байх хугацаа
    rematchCooldownMs: int(env.REMATCH_COOLDOWN_MS, 15000),
    maxMessageLength: int(env.MAX_MESSAGE_LENGTH, 1000),
    reportLogFile: env.REPORT_LOG_FILE || '',
    reportHashSalt: env.REPORT_HASH_SALT || randomBytes(16).toString('hex'),
    reportBanThreshold: int(env.REPORT_BAN_THRESHOLD, 3),
    reportBanMs: int(env.REPORT_BAN_MS, 15 * 60 * 1000),
    adminToken: env.ADMIN_TOKEN || '',
    // /admin хуудсанд оруулах нууц код (5 оронтой тоо, нэр г.м.)
    adminPassword: env.ADMIN_PASSWORD || '',
    adminSessionHours: int(env.ADMIN_SESSION_HOURS, 12),
    trustProxy: env.TRUST_PROXY === 'true',
    serveClient: env.SERVE_CLIENT !== 'false',
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY || '',
      privateKey: env.VAPID_PRIVATE_KEY || '',
      subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    },
    // Нууц хана (confession). Upstash Redis тохируулбал сервер дахин асахад ч хадгалагдана.
    confessions: {
      upstashUrl: env.UPSTASH_REDIS_REST_URL || '',
      upstashToken: env.UPSTASH_REDIS_REST_TOKEN || '',
      file: env.CONFESSION_FILE || '',
      minLength: int(env.CONFESSION_MIN_LENGTH, 1),
      maxLength: int(env.CONFESSION_MAX_LENGTH, 1000),
      maxItems: int(env.CONFESSION_MAX_ITEMS, 2000),
      retentionDays: int(env.CONFESSION_RETENTION_DAYS, 30),
      topWindowDays: int(env.CONFESSION_TOP_DAYS, 7),
      hideReports: int(env.CONFESSION_HIDE_REPORTS, 3),
      postBurst: int(env.CONFESSION_POST_BURST, 3),
      postIntervalSec: int(env.CONFESSION_POST_INTERVAL_SEC, 300),
      saveDelayMs: int(env.CONFESSION_SAVE_DELAY_MS, 5000),
      // Зураг: клиент JPEG болгож шахсан байх ёстой (дээд хэмжээ, дээд өргөн/өндөр)
      imageMaxBytes: int(env.CONFESSION_IMAGE_MAX_BYTES, 350 * 1024),
      imageMaxSide: int(env.CONFESSION_IMAGE_MAX_SIDE, 2048),
      // Шинэ бичлэгийн push: нэг хэрэглэгчид хамгийн ихдээ N мс тутамд нэг
      pushCooldownMs: int(env.CONFESSION_PUSH_COOLDOWN_MS, 3 * 60 * 1000),
      maxSubscribers: int(env.CONFESSION_MAX_SUBSCRIBERS, 5000),
    },
    limits: {
      connectPerMinute: int(env.LIMIT_CONNECT_PER_MINUTE, 30),
      messageBurst: int(env.LIMIT_MESSAGE_BURST, 10),
      messagePerSecond: Number(env.LIMIT_MESSAGE_PER_SECOND) || 3,
    },
  };
  return {
    ...base,
    ...overrides,
    vapid: { ...base.vapid, ...(overrides.vapid || {}) },
    confessions: { ...base.confessions, ...(overrides.confessions || {}) },
    limits: { ...base.limits, ...(overrides.limits || {}) },
  };
}
