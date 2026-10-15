import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';

const HOUR = 60 * 60 * 1000;
const SESSION_RE = /^as_[a-f0-9]{48}$/;

const digest = (value) => createHash('sha256').update(String(value)).digest();
const sameSecret = (a, b) => timingSafeEqual(digest(a), digest(b));

/**
 * Админ нэвтрэлт.
 *  - ADMIN_PASSWORD: хүний санаж болох нууц код (жишээ нь 5 оронтой тоо, нэр). /admin хуудсанд оруулна.
 *    Нэвтэрмэгц түр session токен өгнө (санах ойд, ADMIN_SESSION_HOURS цаг хүчинтэй).
 *  - ADMIN_TOKEN: урт токен — API-г шууд дуудах, нөөц хандалт.
 *
 * Богино код таахаас хамгаалах: нэг IP 15 минутад 5 буруу оролдлого,
 * нийтдээ 1 цагт 30 буруу оролдлого хийгдвэл кодоор нэвтрэхийг 1 цаг түгжинэ.
 */
export function createAdminAuth(config) {
  const sessions = new Map(); // token -> expiresAt
  const perIp = new Map(); // ip -> буруу оролдлогын цагууд
  const IP_WINDOW = 15 * 60 * 1000;
  const IP_MAX = 5;
  let failures = []; // нийт буруу оролдлогын цаг
  let lockedUntil = 0;
  const sessionMs = (config.adminSessionHours || 12) * HOUR;
  const password = (config.adminPassword || '').trim();

  const ipOf = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

  function isAuthorized(req) {
    const auth = req.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7).trim();
    if (config.adminToken && sameSecret(token, config.adminToken)) return true;
    if (!SESSION_RE.test(token)) return false;
    const exp = sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  const router = express.Router();
  router.use(express.json({ limit: '1kb' }));

  router.post('/login', (req, res) => {
    const now = Date.now();
    if (!password) return res.status(503).json({ ok: false, error: 'not_configured' });
    if (lockedUntil > now) {
      return res.status(429).json({ ok: false, error: 'locked', retryAfterMs: lockedUntil - now });
    }
    const ip = ipOf(req);
    const recent = (perIp.get(ip) || []).filter((t) => now - t < IP_WINDOW);
    // Хязгаар давсан бол кодыг шалгахгүй (зөв код ч ажиллахгүй) — таах боломжгүй болгоно
    if (recent.length >= IP_MAX) {
      perIp.set(ip, recent);
      return res.status(429).json({ ok: false, error: 'rate_limited', retryAfterMs: IP_WINDOW - (now - recent[0]) });
    }
    const given = typeof req.body?.password === 'string' ? req.body.password.trim().slice(0, 200) : '';

    if (given && sameSecret(given, password)) {
      const token = `as_${randomBytes(24).toString('hex')}`;
      sessions.set(token, now + sessionMs);
      for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
      return res.json({ ok: true, token, expiresAt: now + sessionMs });
    }

    recent.push(now);
    perIp.set(ip, recent);
    for (const [k, list] of perIp) if (!list.some((t) => now - t < IP_WINDOW)) perIp.delete(k);
    failures = failures.filter((t) => now - t < HOUR);
    failures.push(now);
    if (failures.length >= 30) {
      lockedUntil = now + HOUR;
      console.warn('[admin] Хэт олон буруу оролдлого — кодоор нэвтрэхийг 1 цаг түгжлээ');
    }
    return res.status(401).json({ ok: false, error: 'wrong_password' });
  });

  router.post('/logout', (req, res) => {
    const token = (req.get('authorization') || '').slice(7).trim();
    sessions.delete(token);
    res.json({ ok: true });
  });

  return { router, isAuthorized, configured: !!password, _internal: { sessions, perIp, reset: () => ((failures = []), (lockedUntil = 0)) } };
}
