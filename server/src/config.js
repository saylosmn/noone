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
    reconnectGraceMs: int(env.RECONNECT_GRACE_MS, 20000),
    // Саяхан ярьсан хүнтэй дахин холбохгүй байх хугацаа
    rematchCooldownMs: int(env.REMATCH_COOLDOWN_MS, 15000),
    maxMessageLength: int(env.MAX_MESSAGE_LENGTH, 1000),
    reportLogFile: env.REPORT_LOG_FILE || '',
    reportHashSalt: env.REPORT_HASH_SALT || randomBytes(16).toString('hex'),
    reportBanThreshold: int(env.REPORT_BAN_THRESHOLD, 3),
    reportBanMs: int(env.REPORT_BAN_MS, 15 * 60 * 1000),
    adminToken: env.ADMIN_TOKEN || '',
    trustProxy: env.TRUST_PROXY === 'true',
    serveClient: env.SERVE_CLIENT !== 'false',
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY || '',
      privateKey: env.VAPID_PRIVATE_KEY || '',
      subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    },
    limits: {
      connectPerMinute: int(env.LIMIT_CONNECT_PER_MINUTE, 30),
      messageBurst: int(env.LIMIT_MESSAGE_BURST, 6),
      messagePerSecond: Number(env.LIMIT_MESSAGE_PER_SECOND) || 1,
    },
  };
  return {
    ...base,
    ...overrides,
    vapid: { ...base.vapid, ...(overrides.vapid || {}) },
    limits: { ...base.limits, ...(overrides.limits || {}) },
  };
}
