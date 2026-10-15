import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { KeyedLimiter } from './limiter.js';
import { CONFESSION_REPORT_REASONS, CONFESSION_TAGS, SCHOOLS } from './constants.js';
import { maskProfanity } from './profanity.js';
import { sanitizeText } from './chat.js';

const STORE_KEY = 'noone:confessions:v1';
const DEVICE_RE = /^d_[a-f0-9]{32}$/;
const ID_RE = /^cf_[a-f0-9]{12}$/;
const PAGE_SIZE = 20;
const DAY = 24 * 60 * 60 * 1000;

// Утас, линк, @хаяг, имэйл — нэргүй хананд хэн нэгнийг ил гаргахаас сэргийлнэ
const CONTACT_PATTERNS = [
  /(?<!\d)(?:\+?976[\s.\-]*)?[5-9]\d(?:[\s.\-]?\d){6}(?!\d)/, // монгол утас (99 11 22 33, +976 8811-2233)
  /\d{8,}/, // урт тоо
  /\b(?:https?:\/\/|www\.)/i,
  /\b[\w-]+\.(?:com|mn|net|org|io|me|gg|link|xyz|app|ru|co|tv|ly|to)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/u, // имэйл
  /(?:^|[\s(])@[\p{L}\p{N}_.]{3,}/u, // @username
  /\b(?:ig|insta|instagram|tg|telegram|snap|snapchat|fb|facebook|discord)\s*[:=]\s*\S/i,
];

export const containsContactInfo = (text) => CONTACT_PATTERNS.some((re) => re.test(text));

const normalize = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Нууц хана — нэргүй confession бичих, like дарах, мэдээлэх.
 * Зохиогчийн IP, төхөөрөмжийн ID-г ХАДГАЛАХГҮЙ — зөвхөн давс нэмсэн богино hash.
 */
export function createConfessions({ config, kv }) {
  const c = config.confessions;
  const items = new Map(); // id -> item (Map нь оруулсан дарааллаа хадгална)
  const recentHashes = new Map(); // normalized text hash -> ts (давхардал)
  let loaded = false;
  let dirty = false;
  let saveTimer = null;
  let saving = Promise.resolve();
  // Хяналтын тохиргоо: auto — шууд нийтэлнэ, manual — админ зөвшөөрсний дараа л харагдана
  const settings = { moderation: c.moderation === 'manual' ? 'manual' : 'auto' };
  const bans = new Map(); // 'd:<hash>' | 'i:<hash>' -> { until, at, reason }

  const hash = (kind, value) =>
    createHash('sha256').update(`${config.reportHashSalt}|${kind}|${value}`).digest('hex').slice(0, 16);

  const limits = {
    postDevice: new KeyedLimiter({ capacity: c.postBurst, refillPerSec: 1 / c.postIntervalSec }),
    postIp: new KeyedLimiter({ capacity: 30, refillPerSec: 30 / 3600 }),
    like: new KeyedLimiter({ capacity: 60, refillPerSec: 1 }),
    likeIp: new KeyedLimiter({ capacity: 400, refillPerSec: 400 / 3600 }),
    report: new KeyedLimiter({ capacity: 10, refillPerSec: 10 / 3600 }),
    read: new KeyedLimiter({ capacity: 120, refillPerSec: 2 }),
    adminFail: new KeyedLimiter({ capacity: 10, refillPerSec: 10 / 900 }),
  };

  // Харагдах эсэх: нуугдаагүй, хянагдаж буй биш
  const isPublic = (it) => !it.hidden && !it.pending;

  function banUntil(v) {
    const now = Date.now();
    let until = 0;
    for (const key of [v.device && `d:${v.device}`, `i:${v.ip}`]) {
      const b = key && bans.get(key);
      if (b && b.until > now) until = Math.max(until, b.until);
    }
    return until;
  }

  // ---------- Хадгалалт ----------
  const serialize = () => ({
    v: 1,
    settings,
    bans: [...bans.entries()],
    items: [...items.values()].map((it) => ({
      ...it,
      likers: [...it.likers],
      reporters: [...it.reporters],
    })),
  });

  async function load() {
    try {
      const data = await kv.get(STORE_KEY);
      if (data?.settings?.moderation === 'manual' || data?.settings?.moderation === 'auto') {
        settings.moderation = data.settings.moderation;
      }
      for (const [key, b] of data?.bans || []) if (b?.until > Date.now()) bans.set(key, b);
      for (const raw of data?.items || []) {
        if (!ID_RE.test(raw.id)) continue;
        items.set(raw.id, { ...raw, likers: new Set(raw.likers || []), reporters: new Set(raw.reporters || []) });
      }
      prune();
      console.log(`[confessions] ${items.size} confession ачааллаа (${kv.kind})`);
    } catch (err) {
      console.warn(`[confessions] ачаалж чадсангүй: ${err.message}`);
    } finally {
      loaded = true;
    }
  }
  const ready = load();

  function scheduleSave() {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flush();
    }, c.saveDelayMs);
    saveTimer.unref?.();
  }

  function flush() {
    if (!dirty) return saving;
    dirty = false;
    const snapshot = serialize();
    saving = saving
      .then(() => kv.set(STORE_KEY, snapshot))
      .catch((err) => {
        dirty = true;
        console.warn(`[confessions] хадгалж чадсангүй: ${err.message}`);
      });
    return saving;
  }

  function prune() {
    const cutoff = Date.now() - c.retentionDays * DAY;
    for (const [id, it] of items) if (it.ts < cutoff) items.delete(id);
    while (items.size > c.maxItems) items.delete(items.keys().next().value);
    for (const [h, ts] of recentHashes) if (Date.now() - ts > DAY) recentHashes.delete(h);
    for (const [key, b] of bans) if (b.until <= Date.now()) bans.delete(key);
  }
  const pruneTimer = setInterval(() => {
    const before = items.size;
    prune();
    if (items.size !== before) scheduleSave();
    for (const l of Object.values(limits)) l.sweep();
  }, 10 * 60 * 1000);
  pruneTimer.unref?.();

  // ---------- Туслах ----------
  const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

  function viewer(req) {
    const device = req.get('x-noone-device');
    const valid = typeof device === 'string' && DEVICE_RE.test(device);
    return {
      device: valid ? hash('device', device) : null,
      ip: hash('ip', clientIp(req)),
    };
  }

  const toPublic = (it, v) => ({
    id: it.id,
    text: it.text,
    tag: it.tag,
    school: it.school || null,
    ts: it.ts,
    likes: it.likers.size,
    liked: v.device ? it.likers.has(v.device) : false,
    mine: v.device ? it.author === v.device : false,
    pending: !!it.pending,
  });

  const fail = (res, status, error, extra = {}) => res.status(status).json({ ok: false, error, ...extra });

  const limited = (res, result) => {
    res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
    return fail(res, 429, 'rate_limited', { retryAfterMs: result.retryAfterMs });
  };

  const matchesSchool = (itemSchool, filter) =>
    !filter || itemSchool === filter || (filter === 'must' && itemSchool?.startsWith('must'));

  // ---------- Router ----------
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  router.use((req, res, next) => {
    if (!loaded) return fail(res, 503, 'loading');
    next();
  });

  router.get('/', (req, res) => {
    const v = viewer(req);
    const r = limits.read.take(v.ip);
    if (!r.ok) return limited(res, r);

    const sort = req.query.sort === 'top' ? 'top' : 'new';
    const tag = CONFESSION_TAGS.includes(req.query.tag) ? req.query.tag : null;
    const school = SCHOOLS.includes(req.query.school) ? req.query.school : null;
    const offset = Math.min(Math.max(Number.parseInt(req.query.offset, 10) || 0, 0), 2000);

    let list = [...items.values()].filter((it) => (isPublic(it) || (it.pending && !it.hidden && v.device && it.author === v.device)) && (!tag || it.tag === tag) && matchesSchool(it.school, school));
    if (sort === 'top') {
      const since = Date.now() - c.topWindowDays * DAY;
      list = list.filter((it) => it.ts >= since).sort((a, b) => b.likers.size - a.likers.size || b.ts - a.ts);
    } else {
      list.sort((a, b) => b.ts - a.ts);
    }
    const page = list.slice(offset, offset + PAGE_SIZE);
    res.json({
      ok: true,
      items: page.map((it) => toPublic(it, v)),
      next: offset + PAGE_SIZE < list.length ? offset + PAGE_SIZE : null,
      total: list.length,
    });
  });

  router.get('/:id', (req, res) => {
    const it = items.get(req.params.id);
    const v = viewer(req);
    if (!it || it.hidden || (it.pending && it.author !== v.device)) return fail(res, 404, 'not_found');
    res.json({ ok: true, item: toPublic(it, v) });
  });

  router.post('/', (req, res) => {
    const v = viewer(req);
    if (!v.device) return fail(res, 400, 'no_device');
    const body = req.body || {};
    if (body.adultConfirmed !== true) return fail(res, 400, 'adult_confirmation_required');
    const banned = banUntil(v);
    if (banned) return fail(res, 403, 'banned', { until: banned });

    const clean = sanitizeText(body.text, c.maxLength);
    if (clean.error) return fail(res, 400, clean.error);
    if ([...clean.text].length < c.minLength) return fail(res, 400, 'too_short');
    if (containsContactInfo(clean.text)) return fail(res, 400, 'contact_info');

    const tag = CONFESSION_TAGS.includes(body.tag) ? body.tag : 'secret';
    const school = body.school && SCHOOLS.includes(body.school) && body.school !== 'other' ? body.school : null;

    const textHash = hash('text', normalize(clean.text));
    if (recentHashes.has(textHash)) return fail(res, 409, 'duplicate');

    for (const [limiter, key] of [
      [limits.postDevice, v.device],
      [limits.postIp, v.ip],
    ]) {
      const r = limiter.take(key);
      if (!r.ok) return limited(res, r);
    }

    const item = {
      id: `cf_${randomBytes(6).toString('hex')}`,
      text: maskProfanity(clean.text).text,
      tag,
      school,
      ts: Date.now(),
      author: v.device,
      authorIp: v.ip,
      likers: new Set(),
      reporters: new Set(),
      hidden: false,
      pending: settings.moderation === 'manual',
    };
    items.set(item.id, item);
    recentHashes.set(textHash, item.ts);
    prune();
    scheduleSave();
    res.status(201).json({ ok: true, item: toPublic(item, v) });
  });

  router.post('/:id/like', (req, res) => {
    const v = viewer(req);
    if (!v.device) return fail(res, 400, 'no_device');
    const it = items.get(req.params.id);
    if (!it || !isPublic(it)) return fail(res, 404, 'not_found');
    for (const [limiter, key] of [
      [limits.like, v.device],
      [limits.likeIp, v.ip],
    ]) {
      const r = limiter.take(key);
      if (!r.ok) return limited(res, r);
    }
    const like = req.body?.like !== false;
    const had = it.likers.has(v.device);
    if (like && !had && it.likers.size < 100000) it.likers.add(v.device);
    if (!like && had) it.likers.delete(v.device);
    if (had !== it.likers.has(v.device)) scheduleSave();
    res.json({ ok: true, likes: it.likers.size, liked: it.likers.has(v.device) });
  });

  router.post('/:id/report', (req, res) => {
    const v = viewer(req);
    if (!v.device) return fail(res, 400, 'no_device');
    const it = items.get(req.params.id);
    if (!it) return fail(res, 404, 'not_found');
    const reason = req.body?.reason;
    if (!CONFESSION_REPORT_REASONS.includes(reason)) return fail(res, 400, 'invalid_reason');
    if (it.author === v.device) return fail(res, 400, 'own_post');
    const r = limits.report.take(v.device);
    if (!r.ok) return limited(res, r);

    if (!it.reporters.has(v.device)) {
      it.reporters.add(v.device);
      it.reasons = { ...(it.reasons || {}), [reason]: (it.reasons?.[reason] || 0) + 1 };
      // Хувийн мэдээлэл, насанд хүрээгүй гэсэн мэдээлэл хурдан нуугдана
      const threshold = reason === 'personal_info' || reason === 'minor' ? Math.max(1, c.hideReports - 1) : c.hideReports;
      if (it.reporters.size >= threshold && !it.approved) {
        it.hidden = true;
        it.hiddenBy = 'reports';
      }
      // Админ зөвшөөрсөн байсан ч олон мэдээлэл ирвэл дахин нууна
      if (it.approved && it.reporters.size >= threshold * 2) {
        it.hidden = true;
        it.hiddenBy = 'reports';
      }
      scheduleSave();
    }
    res.json({ ok: true, hidden: it.hidden });
  });

  // Зохиогч өөрийнхөө confession-ийг устгана
  router.delete('/:id', (req, res) => {
    const v = viewer(req);
    const it = items.get(req.params.id);
    if (!it) return fail(res, 404, 'not_found');
    if (!v.device || it.author !== v.device) return fail(res, 403, 'forbidden');
    items.delete(it.id);
    scheduleSave();
    res.json({ ok: true });
  });

  // JSON алдаа гэх мэт
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => fail(res, err.status === 413 ? 413 : 400, err.status === 413 ? 'too_long' : 'invalid'));

  // ---------- Админ ----------
  const safeEqual = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
  };
  const admin = express.Router();
  admin.use(express.json({ limit: '2kb' }));
  admin.use((req, res, next) => {
    const ipKey = hash('ip', clientIp(req));
    const auth = req.get('authorization') || '';
    if (config.adminToken && safeEqual(auth, `Bearer ${config.adminToken}`)) return next();
    // Нууц үг таахаас сэргийлж буруу оролдлогыг хязгаарлана
    const r = limits.adminFail.take(ipKey);
    if (!r.ok) return limited(res, r);
    return res.sendStatus(404);
  });

  const adminItem = (it) => ({
    id: it.id,
    text: it.text,
    tag: it.tag,
    school: it.school || null,
    ts: it.ts,
    likes: it.likers.size,
    reports: it.reporters.size,
    reasons: it.reasons || {},
    hidden: !!it.hidden,
    hiddenBy: it.hidden ? it.hiddenBy || 'admin' : null,
    pending: !!it.pending,
    approved: !!it.approved,
    author: it.author ? it.author.slice(0, 6) : null,
    authorPosts: [...items.values()].filter((x) => x.author === it.author).length,
    authorBanned: bans.has(`d:${it.author}`) && bans.get(`d:${it.author}`).until > Date.now(),
  });

  const adminStats = () => {
    const all = [...items.values()];
    return {
      total: all.length,
      public: all.filter(isPublic).length,
      pending: all.filter((it) => it.pending && !it.hidden).length,
      reported: all.filter((it) => it.reporters.size > 0 && !it.hidden && !it.approved).length,
      hidden: all.filter((it) => it.hidden).length,
      bans: [...bans.values()].filter((b) => b.until > Date.now()).length,
      today: all.filter((it) => Date.now() - it.ts < DAY).length,
    };
  };

  admin.get('/', (req, res) => {
    const filter = ['reported', 'pending', 'hidden', 'all'].includes(req.query.filter) ? req.query.filter : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 100) : '';
    let list = [...items.values()];
    if (filter === 'reported') list = list.filter((it) => it.reporters.size > 0 && !it.hidden && !it.approved);
    if (filter === 'pending') list = list.filter((it) => it.pending && !it.hidden);
    if (filter === 'hidden') list = list.filter((it) => it.hidden);
    if (q) list = list.filter((it) => it.text.toLowerCase().includes(q));
    list.sort(filter === 'reported' ? (a, b) => b.reporters.size - a.reporters.size || b.ts - a.ts : (a, b) => b.ts - a.ts);
    res.json({
      ok: true,
      storage: kv.kind,
      settings,
      stats: adminStats(),
      count: list.length,
      items: list.slice(0, 300).map(adminItem),
    });
  });

  admin.get('/settings', (req, res) => res.json({ ok: true, settings }));
  admin.post('/settings', (req, res) => {
    const m = req.body?.moderation;
    if (m !== 'auto' && m !== 'manual') return fail(res, 400, 'invalid');
    settings.moderation = m;
    scheduleSave();
    res.json({ ok: true, settings });
  });

  const withItem = (handler) => (req, res) => {
    const it = items.get(req.params.id);
    if (!it) return fail(res, 404, 'not_found');
    handler(it, req, res);
    scheduleSave();
    if (!res.headersSent) res.json({ ok: true, item: items.has(it.id) ? adminItem(it) : null, stats: adminStats() });
  };

  // Нуух / сэргээх (backward compatible: {hidden:false} = сэргээх)
  admin.post(
    '/:id/hide',
    withItem((it, req) => {
      it.hidden = req.body?.hidden !== false;
      it.hiddenBy = it.hidden ? 'admin' : null;
      if (!it.hidden) it.pending = false;
    }),
  );
  // Зөвшөөрөх: нийтэлж, мэдээллийг цэвэрлэнэ
  admin.post(
    '/:id/approve',
    withItem((it) => {
      it.pending = false;
      it.hidden = false;
      it.hiddenBy = null;
      it.approved = true;
      it.reporters.clear();
      it.reasons = {};
    }),
  );
  admin.delete('/:id', (req, res) => {
    if (!items.delete(req.params.id)) return fail(res, 404, 'not_found');
    scheduleSave();
    res.json({ ok: true, stats: adminStats() });
  });
  // Зохиогчийг хориглох: төхөөрөмж + IP, бүх бичлэгийг нь нууна
  admin.post('/:id/ban', (req, res) => {
    const it = items.get(req.params.id);
    if (!it) return fail(res, 404, 'not_found');
    const days = [1, 7, 30, 365].includes(req.body?.days) ? req.body.days : 7;
    const ban = { until: Date.now() + days * DAY, at: Date.now(), from: it.id, text: it.text.slice(0, 80) };
    if (it.author) bans.set(`d:${it.author}`, ban);
    if (it.authorIp && req.body?.ip !== false) bans.set(`i:${it.authorIp}`, ban);
    let hiddenCount = 0;
    for (const x of items.values()) {
      if (x.author === it.author && !x.hidden) {
        x.hidden = true;
        x.hiddenBy = 'admin';
        hiddenCount += 1;
      }
    }
    scheduleSave();
    res.json({ ok: true, hiddenCount, until: ban.until, stats: adminStats() });
  });
  admin.get('/bans', (req, res) => {
    const now = Date.now();
    res.json({
      ok: true,
      bans: [...bans.entries()]
        .filter(([, b]) => b.until > now)
        .map(([key, b]) => ({ key, kind: key[0] === 'd' ? 'device' : 'ip', until: b.until, at: b.at, text: b.text || '' })),
    });
  });
  admin.delete('/bans/:key', (req, res) => {
    if (!bans.delete(req.params.key)) return fail(res, 404, 'not_found');
    scheduleSave();
    res.json({ ok: true, stats: adminStats() });
  });

  return {
    router,
    admin,
    ready,
    flush,
    storageKind: kv.kind,
    count: () => items.size,
    async close() {
      clearInterval(pruneTimer);
      clearTimeout(saveTimer);
      saveTimer = null;
      await flush();
    },
    _internal: { items, recentHashes, limits, bans, settings },
  };
}
