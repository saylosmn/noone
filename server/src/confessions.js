import { createHash, randomBytes } from 'node:crypto';
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

  const hash = (kind, value) =>
    createHash('sha256').update(`${config.reportHashSalt}|${kind}|${value}`).digest('hex').slice(0, 16);

  const limits = {
    postDevice: new KeyedLimiter({ capacity: c.postBurst, refillPerSec: 1 / c.postIntervalSec }),
    postIp: new KeyedLimiter({ capacity: 30, refillPerSec: 30 / 3600 }),
    like: new KeyedLimiter({ capacity: 60, refillPerSec: 1 }),
    likeIp: new KeyedLimiter({ capacity: 400, refillPerSec: 400 / 3600 }),
    report: new KeyedLimiter({ capacity: 10, refillPerSec: 10 / 3600 }),
    read: new KeyedLimiter({ capacity: 120, refillPerSec: 2 }),
  };

  // ---------- Хадгалалт ----------
  const serialize = () => ({
    v: 1,
    items: [...items.values()].map((it) => ({
      ...it,
      likers: [...it.likers],
      reporters: [...it.reporters],
    })),
  });

  async function load() {
    try {
      const data = await kv.get(STORE_KEY);
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

    let list = [...items.values()].filter((it) => !it.hidden && (!tag || it.tag === tag) && matchesSchool(it.school, school));
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
    if (!it || it.hidden) return fail(res, 404, 'not_found');
    res.json({ ok: true, item: toPublic(it, viewer(req)) });
  });

  router.post('/', (req, res) => {
    const v = viewer(req);
    if (!v.device) return fail(res, 400, 'no_device');
    const body = req.body || {};
    if (body.adultConfirmed !== true) return fail(res, 400, 'adult_confirmation_required');

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
    if (!it || it.hidden) return fail(res, 404, 'not_found');
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
      if (it.reporters.size >= threshold) it.hidden = true;
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
  const admin = express.Router();
  admin.use(express.json({ limit: '1kb' }));
  admin.use((req, res, next) => {
    if (!config.adminToken || req.get('authorization') !== `Bearer ${config.adminToken}`) return res.sendStatus(404);
    next();
  });
  admin.get('/', (req, res) => {
    const list = [...items.values()]
      .sort((a, b) => b.ts - a.ts)
      .map((it) => ({
        id: it.id,
        text: it.text,
        tag: it.tag,
        school: it.school,
        ts: it.ts,
        likes: it.likers.size,
        reports: it.reporters.size,
        reasons: it.reasons || {},
        hidden: it.hidden,
        author: it.author,
      }));
    res.json({ storage: kv.kind, count: list.length, items: list });
  });
  admin.post('/:id/hide', (req, res) => {
    const it = items.get(req.params.id);
    if (!it) return res.sendStatus(404);
    it.hidden = req.body?.hidden !== false;
    scheduleSave();
    res.json({ ok: true, hidden: it.hidden });
  });
  admin.delete('/:id', (req, res) => {
    if (!items.delete(req.params.id)) return res.sendStatus(404);
    scheduleSave();
    res.json({ ok: true });
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
    _internal: { items, recentHashes, limits },
  };
}
