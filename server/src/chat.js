import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { KeyedLimiter } from './limiter.js';
import {
  CONTACT_PLATFORMS,
  GENDERS,
  INTERESTS,
  PARTNER_NAME,
  REACTIONS,
  REPORT_REASONS,
  SCHOOLS,
  sharedSchool as getSharedSchool,
  STICKERS,
} from './constants.js';
import { maskProfanity } from './profanity.js';
import { isValidSubscription } from './push.js';

const MESSAGE_ID_RE = /^m_[a-f0-9]{16}$/;
const ID_RE = /^c_[a-f0-9]{24}$/;
const HANDLE_RE = /^[\p{L}\p{N}._@+\-#: ]{2,50}$/u;
// Илгээснээс хойш хэдэн мс-ийн дотор мессежээ буцааж болох
export const UNSEND_WINDOW_MS = 60 * 1000;
const opposite = (gender) => (gender === 'male' ? 'female' : 'male');
const hex = (bytes) => randomBytes(bytes).toString('hex');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Хяналтын тэмдэгтүүдийг арилгаж, мөр хоорондын хоосон зайг хязгаарлана. */
export function sanitizeText(input, maxLength) {
  if (typeof input !== 'string') return { error: 'invalid' };
  // eslint-disable-next-line no-control-regex
  let text = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  text = text.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!text) return { error: 'empty' };
  if ([...text].length > maxLength) return { error: 'too_long' };
  return { text };
}

/**
 * Хослуулах дараалал, өрөө, мессеж дамжуулалт.
 * Мессежийн агуулгыг ХАДГАЛАХГҮЙ — зөвхөн нөгөө хүн рүү дамжуулна.
 */
export function attachChat(io, { config, push, reports }) {
  const clients = new Map(); // clientId -> client
  const rooms = new Map(); // roomId -> room
  const queues = { male: new Set(), female: new Set() };
  const restrictions = new Map(); // ipHash -> { reports: [{ts, by}], bannedUntil }
  const counters = { matches: 0, ratings: { good: 0, bad: 0 }, reports: 0 };

  const limits = {
    connect: new KeyedLimiter({ capacity: config.limits.connectPerMinute, refillPerSec: config.limits.connectPerMinute / 60 }),
    message: new KeyedLimiter({ capacity: config.limits.messageBurst, refillPerSec: config.limits.messagePerSecond }),
    typing: new KeyedLimiter({ capacity: 10, refillPerSec: 2 }),
    seen: new KeyedLimiter({ capacity: 10, refillPerSec: 2 }),
    queue: new KeyedLimiter({ capacity: 8, refillPerSec: 1 / 3 }),
    report: new KeyedLimiter({ capacity: 5, refillPerSec: 5 / 3600 }),
    misc: new KeyedLimiter({ capacity: 20, refillPerSec: 1 }),
  };

  const ipHash = (ip) =>
    createHash('sha256').update(`${config.reportHashSalt}|ip|${ip}`).digest('hex').slice(0, 16);

  const socketIp = (socket) => {
    if (config.trustProxy) {
      const fwd = socket.handshake.headers['x-forwarded-for'];
      if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
    }
    return socket.handshake.address || 'unknown';
  };

  const emitTo = (client, event, payload) => {
    if (client?.socketId) io.to(client.socketId).emit(event, payload);
  };

  const onlineCount = () => {
    let n = 0;
    for (const c of clients.values()) if (c.socketId) n += 1;
    return n;
  };

  const statsPayload = () => ({
    online: onlineCount(),
    waiting: { male: queues.male.size, female: queues.female.size },
  });

  // ---------- Хязгаарлалт (олон мэдээлэл авсан IP) ----------
  function restrictedUntil(client) {
    const r = restrictions.get(client.ipHash);
    return r && r.bannedUntil > Date.now() ? r.bannedUntil : 0;
  }

  function recordReportAgainst(reportedIpHash, reporterIpHash) {
    const now = Date.now();
    const r = restrictions.get(reportedIpHash) || { reports: [], bannedUntil: 0 };
    r.reports = r.reports.filter((x) => now - x.ts < 60 * 60 * 1000);
    r.reports.push({ ts: now, by: reporterIpHash });
    const distinct = new Set(r.reports.map((x) => x.by)).size;
    if (distinct >= config.reportBanThreshold) r.bannedUntil = now + config.reportBanMs;
    restrictions.set(reportedIpHash, r);
  }

  // ---------- Клиент ----------
  function createClient(ipH) {
    const client = {
      id: `c_${hex(12)}`,
      resumeToken: hex(24),
      ipHash: ipH,
      socketId: null,
      gender: null,
      interests: [],
      school: null,
      adultConfirmed: false,
      status: 'idle', // idle | queued | chatting
      roomId: null,
      queuedAt: 0,
      phaseAnnounced: false,
      blocked: new Set(),
      recent: new Map(),
      last: null, // { roomId, partnerId, partnerIpHash, startedAt, endedAt, rated }
      visible: true,
      pushSub: null,
      pending: [], // апп хаалттай үед ирсэн, хүргэгдээгүй мессежүүд (зөвхөн санах ойд, түр)
      lastPushAt: 0,
      lastTexts: [],
      sent: new Map(), // одоогийн чатад илгээсэн мессежийн ID -> цаг (агуулгагүй, буцаахад)
      pendingUnsent: [], // холболт тасарсан үед буцаагдсан мессежийн ID-ууд
      disconnectTimer: null,
    };
    clients.set(client.id, client);
    return client;
  }

  function deleteClient(client) {
    removeFromQueue(client);
    if (client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) endRoom(room, client, 'disconnected');
    }
    clearTimeout(client.disconnectTimer);
    clients.delete(client.id);
    for (const l of Object.values(limits)) l.delete(client.id);
  }

  function describeState(client) {
    const room = client.roomId ? rooms.get(client.roomId) : null;
    if (!room) return { status: client.status === 'queued' ? 'queued' : 'idle', room: null };
    const partner = clients.get(room.a === client.id ? room.b : room.a);
    const partnerOffer = partner ? room.friend[partner.id] : null;
    return {
      status: 'chatting',
      room: {
        roomId: room.id,
        startedAt: room.startedAt,
        sharedInterests: room.sharedInterests,
        sharedSchool: room.sharedSchool,
        partner: { nickname: PARTNER_NAME, online: Boolean(partner?.socketId) },
        friend: {
          mine: room.friend[client.id] || null,
          partnerOffered: Boolean(partnerOffer),
          partnerContact: room.friendRevealed ? partnerOffer : null,
        },
      },
    };
  }

  // ---------- Дараалал ----------
  function removeFromQueue(client) {
    queues.male.delete(client.id);
    queues.female.delete(client.id);
    if (client.status === 'queued') client.status = 'idle';
  }

  const hasPrefs = (c) => c.interests.length > 0 || Boolean(c.school);
  const isFlexible = (c, now) => !hasPrefs(c) || now - c.queuedAt >= config.interestWaitMs;

  const isBlocked = (a, b) => a.blocked.has(b.id) || b.blocked.has(a.id);

  const recentlyPaired = (a, b, now) => {
    const t = a.recent.get(b.id) ?? b.recent.get(a.id);
    return t !== undefined && now - t < config.rematchCooldownMs;
  };

  function tryMatch(client) {
    if (client.status !== 'queued' || !client.socketId) return false;
    const now = Date.now();
    let best = null;
    let bestShared = [];
    let bestScore = -1;
    let bestSchool = null;
    for (const otherId of queues[opposite(client.gender)]) {
      const other = clients.get(otherId);
      if (!other || other.status !== 'queued' || !other.socketId) continue;
      if (isBlocked(client, other) || recentlyPaired(client, other, now)) continue;
      const shared = client.interests.filter((i) => other.interests.includes(i));
      const school = getSharedSchool(client.school, other.school);
      const sameSchool = school ? school.id : null;
      // Нэг салбар = 3, нэг их сургууль = 2, ижил сонирхол бүр = 1 оноо
      const score = (school ? school.score : 0) + shared.length;
      const allowed = score > 0 || (isFlexible(client, now) && isFlexible(other, now));
      if (!allowed) continue;
      // Оноо өндрийг нь, тэнцвэл эрт хүлээсэн хүнийг (Set нь FIFO дараалалтай)
      if (score > bestScore) {
        best = other;
        bestShared = shared;
        bestScore = score;
        bestSchool = sameSchool;
      }
    }
    if (!best) return false;
    pair(client, best, bestShared, bestSchool);
    return true;
  }

  function pair(a, b, sharedInterests, sharedSchool = null) {
    removeFromQueue(a);
    removeFromQueue(b);
    const now = Date.now();
    const room = {
      id: `r_${hex(8)}`,
      a: a.id,
      b: b.id,
      startedAt: now,
      sharedInterests,
      sharedSchool,
      friend: {}, // clientId -> { platform, handle } — чат дуусахад устна
      friendRevealed: false,
    };
    rooms.set(room.id, room);
    for (const [me, other] of [[a, b], [b, a]]) {
      me.status = 'chatting';
      me.roomId = room.id;
      me.recent.set(other.id, now);
      emitTo(me, 'match:found', {
        roomId: room.id,
        startedAt: now,
        sharedInterests,
        sharedSchool,
        partner: { nickname: PARTNER_NAME, online: true },
      });
      if (!me.visible) notifyPush(me, { title: 'noone', body: 'Хүн олдлоо — чат эхэллээ', tag: 'noone-match' });
    }
    counters.matches += 1;
  }

  function endRoom(room, ender, reason) {
    if (!rooms.has(room.id)) return;
    rooms.delete(room.id);
    const now = Date.now();
    const a = clients.get(room.a);
    const b = clients.get(room.b);
    for (const [me, other, otherId] of [[a, b, room.b], [b, a, room.a]]) {
      if (!me) continue;
      me.status = 'idle';
      me.roomId = null;
      me.lastTexts = [];
      me.pending = [];
      me.sent.clear();
      me.pendingUnsent = [];
      me.recent.set(otherId, now);
      me.last = {
        roomId: room.id,
        partnerId: otherId,
        partnerIpHash: other?.ipHash || null,
        startedAt: room.startedAt,
        endedAt: now,
        rated: false,
      };
    }
    const other = ender.id === room.a ? b : a;
    if (other) {
      emitTo(other, 'chat:typing', { typing: false });
      emitTo(other, 'chat:ended', {
        roomId: room.id,
        reason: reason === 'disconnected' ? 'partner_disconnected' : 'partner_left',
      });
    }
  }

  function enqueue(client, { gender, interests, school }) {
    removeFromQueue(client);
    client.gender = gender;
    client.interests = interests;
    client.school = school ?? null;
    client.status = 'queued';
    client.queuedAt = Date.now();
    client.phaseAnnounced = !hasPrefs(client);
    queues[gender].add(client.id);
    emitTo(client, 'queue:status', {
      phase: hasPrefs(client) ? 'interest' : 'anyone',
      since: client.queuedAt,
    });
    tryMatch(client);
  }

  async function notifyPush(client, payload, force = false) {
    if (!push.enabled || !client.pushSub) return;
    const now = Date.now();
    if (!force && now - client.lastPushAt < 8000) return;
    if (force && now - client.lastPushAt < 3000) return;
    client.lastPushAt = now;
    const result = await push.send(client.pushSub, payload);
    if (result === 'gone') client.pushSub = null;
  }

  // ---------- Тогтмол ажлууд ----------
  const sweeper = setInterval(() => {
    const now = Date.now();
    const queued = [...queues.male, ...queues.female]
      .map((id) => clients.get(id))
      .filter(Boolean)
      .sort((x, y) => x.queuedAt - y.queuedAt);
    for (const c of queued) {
      if (c.status !== 'queued') continue;
      if (!c.phaseAnnounced && isFlexible(c, now)) {
        c.phaseAnnounced = true;
        emitTo(c, 'queue:status', { phase: 'anyone', since: c.queuedAt });
      }
      tryMatch(c);
    }
  }, 1000);

  const statsTimer = setInterval(() => io.emit('stats', statsPayload()), 4000);

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const l of Object.values(limits)) l.sweep();
    for (const c of clients.values()) {
      for (const [id, t] of c.recent) if (now - t > 10 * 60 * 1000) c.recent.delete(id);
    }
    for (const [k, r] of restrictions) {
      r.reports = r.reports.filter((x) => now - x.ts < 60 * 60 * 1000);
      if (!r.reports.length && r.bannedUntil < now) restrictions.delete(k);
    }
  }, 60 * 1000);

  // ---------- Socket холболт ----------
  io.use((socket, next) => {
    const ip = socketIp(socket);
    const res = limits.connect.take(`ip:${ipHash(ip)}`);
    if (!res.ok) return next(new Error('rate_limited'));
    socket.data.ipHash = ipHash(ip);
    next();
  });

  io.on('connection', (socket) => {
    const auth = socket.handshake.auth || {};
    let client = null;
    let resumed = false;

    if (ID_RE.test(auth.clientId || '')) {
      const existing = clients.get(auth.clientId);
      if (existing && safeEqual(existing.resumeToken, auth.resumeToken)) {
        client = existing;
        resumed = true;
        if (existing.socketId && existing.socketId !== socket.id) {
          // Өөр цонх/tab ижил сесс ашиглаж байна — хуучнаас нь сессийг шилжүүлнэ.
          const old = io.sockets.sockets.get(existing.socketId);
          if (old) {
            old.emit('session:replaced');
            old.disconnect(true);
          }
        }
      }
    }
    if (!client) client = createClient(socket.data.ipHash);

    clearTimeout(client.disconnectTimer);
    client.disconnectTimer = null;
    client.socketId = socket.id;
    client.visible = true;
    client.ipHash = socket.data.ipHash;
    socket.data.clientId = client.id;

    socket.emit('session', {
      clientId: client.id,
      resumeToken: client.resumeToken,
      resumed,
      state: describeState(client),
      pushEnabled: push.enabled,
    });
    socket.emit('stats', statsPayload());

    if (resumed && client.roomId) {
      const room = rooms.get(client.roomId);
      const partner = room && clients.get(room.a === client.id ? room.b : room.a);
      if (partner) emitTo(partner, 'chat:partner_status', { online: true });
    }
    // Холболт тасарсан хооронд буцаагдсан мессежүүдийг мэдэгдэнэ
    if (resumed && client.roomId && client.pendingUnsent.length) {
      for (const messageId of client.pendingUnsent.splice(0)) socket.emit('chat:unsent', { messageId });
    }
    // Апп хаалттай байх үед ирсэн мессежүүдийг хүргээд санах ойгоос устгана
    if (resumed && client.roomId && client.pending.length) {
      const queued = client.pending.splice(0);
      const sid = socket.id;
      setTimeout(() => {
        if (client.socketId !== sid) {
          client.pending.unshift(...queued);
          return;
        }
        for (const m of queued) socket.emit('chat:message', m);
      }, 400);
    }

    const current = () => (socket.data.clientId ? clients.get(socket.data.clientId) : null);
    const roomOf = (c) => (c?.roomId ? rooms.get(c.roomId) : null);
    const partnerOf = (c, room) => clients.get(room.a === c.id ? room.b : room.a);

    /** Event handler-ийг алдаанаас хамгаалж, ack-г заавал дуудна. */
    const on = (event, handler) => {
      socket.on(event, (...args) => {
        const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
        const c = current();
        if (!c || c.socketId !== socket.id) return ack({ ok: false, error: 'no_session' });
        try {
          const result = handler(c, args[0] ?? {});
          ack(result ?? { ok: true });
        } catch (err) {
          console.error(`[socket] ${event} алдаа:`, err.message);
          ack({ ok: false, error: 'server_error' });
        }
      });
    };

    on('queue:join', (c, payload) => {
      if (c.status === 'chatting') return { ok: false, error: 'already_chatting' };
      const gender = payload.gender;
      if (!GENDERS.includes(gender)) return { ok: false, error: 'invalid_gender' };
      if (payload.adultConfirmed !== true && !c.adultConfirmed) {
        return { ok: false, error: 'adult_confirmation_required' };
      }
      const interests = Array.isArray(payload.interests)
        ? [...new Set(payload.interests.filter((i) => INTERESTS.includes(i)))]
        : [];
      const lim = limits.queue.take(c.id);
      if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterMs: lim.retryAfterMs };
      const until = restrictedUntil(c);
      if (until) return { ok: false, error: 'restricted', retryAfterMs: until - Date.now() };
      const school = SCHOOLS.includes(payload.school) ? payload.school : null;
      c.adultConfirmed = true;
      enqueue(c, { gender, interests, school });
      return { ok: true, status: c.status };
    });

    on('queue:leave', (c) => {
      removeFromQueue(c);
      return { ok: true };
    });

    on('chat:message', (c, payload) => {
      const room = roomOf(c);
      if (!room) return { ok: false, error: 'not_in_chat' };
      const lim = limits.message.take(c.id);
      if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterMs: lim.retryAfterMs };
      let text = null;
      let sticker = null;
      let masked = false;
      if (payload.sticker !== undefined && payload.sticker !== null) {
        if (!STICKERS.includes(payload.sticker)) return { ok: false, error: 'invalid' };
        sticker = payload.sticker;
      } else {
        const res = sanitizeText(payload.text, config.maxMessageLength);
        if (res.error) return { ok: false, error: res.error };
        ({ text, changed: masked } = maskProfanity(res.text));
      }

      // Ижил мессежийг дахин дахин илгээх спамаас сэргийлнэ
      const now = Date.now();
      // Агуулгыг биш, зөвхөн богино hash-ийг 15 секунд санана. 15 сек дотор ижил мессеж 4 дэх удаагаа бол хориглоно.
      const normSource = sticker ? `sticker:${sticker}` : text.toLowerCase().replace(/\s+/g, ' ');
      const norm = createHash('sha256').update(normSource).digest('base64').slice(0, 16);
      c.lastTexts = c.lastTexts.filter((x) => now - x.ts < 15000);
      if (c.lastTexts.filter((x) => x.norm === norm).length >= 3) {
        return { ok: false, error: 'duplicate' };
      }

      const partner = partnerOf(c, room);
      const canBuffer = Boolean(partner && !partner.socketId && partner.pushSub && push.enabled);
      if (!partner?.socketId && !canBuffer) return { ok: false, error: 'partner_offline' };

      c.lastTexts.push({ norm, ts: now });
      for (const [id, t] of c.sent) if (now - t > UNSEND_WINDOW_MS) c.sent.delete(id);
      const message = {
        id: `m_${hex(8)}`,
        ts: now,
        replyTo: MESSAGE_ID_RE.test(payload.replyTo || '') ? payload.replyTo : null,
        ...(sticker ? { sticker } : { text }),
      };
      c.sent.set(message.id, now);
      if (canBuffer) {
        // Апп хаалттай — буцаж ороход хүргэнэ, push мэдэгдэл илгээнэ
        if (partner.pending.length >= config.pendingMax) return { ok: false, error: 'partner_offline' };
        partner.pending.push(message);
        notifyPush(partner, { title: 'noone', body: 'Шинэ мессеж ирлээ', tag: 'noone-message' }, true);
      } else {
        emitTo(partner, 'chat:message', message);
        if (!partner.visible) notifyPush(partner, { title: 'noone', body: 'Шинэ мессеж ирлээ', tag: 'noone-message' });
      }
      // Шүүгдсэн бол илгээгчид өөрт нь ч яг хүрсэн хэлбэрийг буцаана
      return { ok: true, id: message.id, ts: message.ts, ...(masked ? { text } : {}) };
    });

    on('chat:react', (c, payload) => {
      const room = roomOf(c);
      if (!room) return { ok: false, error: 'not_in_chat' };
      if (!MESSAGE_ID_RE.test(payload.messageId || '')) return { ok: false, error: 'invalid' };
      const emoji = payload.emoji === null ? null : payload.emoji;
      if (emoji !== null && !REACTIONS.includes(emoji)) return { ok: false, error: 'invalid' };
      if (!limits.misc.take(c.id).ok) return { ok: false, error: 'rate_limited' };
      emitTo(partnerOf(c, room), 'chat:reaction', { messageId: payload.messageId, emoji });
      return { ok: true };
    });

    // "Харсан": нөгөө хүний хамгийн сүүлд харсан мессежийн ID-г дамжуулна
    on('chat:seen', (c, payload) => {
      const room = roomOf(c);
      if (!room) return { ok: false, error: 'not_in_chat' };
      if (!MESSAGE_ID_RE.test(payload.messageId || '')) return { ok: false, error: 'invalid' };
      if (!limits.seen.take(c.id).ok) return { ok: false, error: 'rate_limited' };
      emitTo(partnerOf(c, room), 'chat:seen', { messageId: payload.messageId });
      return { ok: true };
    });

    // Мессеж буцаах: зөвхөн өөрийнхөө, илгээснээс хойш 1 минутын дотор
    on('chat:unsend', (c, payload) => {
      const room = roomOf(c);
      if (!room) return { ok: false, error: 'not_in_chat' };
      const messageId = payload.messageId;
      if (!MESSAGE_ID_RE.test(messageId || '')) return { ok: false, error: 'invalid' };
      const sentAt = c.sent.get(messageId);
      if (sentAt === undefined || Date.now() - sentAt > UNSEND_WINDOW_MS) return { ok: false, error: 'unsend_expired' };
      if (!limits.misc.take(c.id).ok) return { ok: false, error: 'rate_limited' };
      c.sent.delete(messageId);
      const partner = partnerOf(c, room);
      if (partner) {
        const idx = partner.pending.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          // Хүргэгдээгүй байсан — нөгөө хүнд огт очихгүй
          partner.pending.splice(idx, 1);
        } else if (partner.socketId) {
          emitTo(partner, 'chat:unsent', { messageId });
        } else if (partner.pendingUnsent.length < config.pendingMax) {
          partner.pendingUnsent.push(messageId);
        }
      }
      return { ok: true };
    });

    on('friend:offer', (c, payload) => {
      const room = roomOf(c);
      if (!room) return { ok: false, error: 'not_in_chat' };
      if (room.friendRevealed) return { ok: false, error: 'already_revealed' };
      if (!CONTACT_PLATFORMS.includes(payload.platform)) return { ok: false, error: 'invalid_platform' };
      const handle = typeof payload.handle === 'string' ? payload.handle.trim().replace(/\s+/g, ' ') : '';
      if (!HANDLE_RE.test(handle)) return { ok: false, error: 'invalid_handle' };
      if (!limits.misc.take(c.id).ok) return { ok: false, error: 'rate_limited' };
      const partner = partnerOf(c, room);
      const firstOffer = !room.friend[c.id];
      room.friend[c.id] = { platform: payload.platform, handle };
      const partnerOffer = partner ? room.friend[partner.id] : null;
      if (partnerOffer) {
        room.friendRevealed = true;
        emitTo(partner, 'friend:reveal', { contact: room.friend[c.id] });
        return { ok: true, status: 'revealed', contact: partnerOffer };
      }
      if (firstOffer) emitTo(partner, 'friend:requested', {});
      return { ok: true, status: 'waiting' };
    });

    on('friend:cancel', (c) => {
      const room = roomOf(c);
      if (!room || room.friendRevealed || !room.friend[c.id]) return { ok: false, error: 'not_allowed' };
      delete room.friend[c.id];
      emitTo(partnerOf(c, room), 'friend:cancelled', {});
      return { ok: true };
    });

    on('chat:typing', (c, payload) => {
      const room = roomOf(c);
      if (!room || !limits.typing.take(c.id).ok) return { ok: false };
      emitTo(partnerOf(c, room), 'chat:typing', { typing: payload.typing === true });
      return { ok: true };
    });

    on('chat:next', (c) => {
      const room = roomOf(c);
      const endedRoomId = room?.id || null;
      if (room) endRoom(room, c, 'next');
      if (!c.gender) return { ok: false, error: 'no_profile', endedRoomId };
      const lim = limits.queue.take(c.id);
      if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterMs: lim.retryAfterMs, endedRoomId };
      const until = restrictedUntil(c);
      if (until) return { ok: false, error: 'restricted', retryAfterMs: until - Date.now(), endedRoomId };
      enqueue(c, { gender: c.gender, interests: c.interests, school: c.school });
      return { ok: true, endedRoomId, status: c.status };
    });

    on('chat:leave', (c) => {
      const room = roomOf(c);
      if (room) endRoom(room, c, 'left');
      removeFromQueue(c);
      return { ok: true, endedRoomId: room?.id || null };
    });

    on('chat:block', (c) => {
      const room = roomOf(c);
      const partnerId = room ? (room.a === c.id ? room.b : room.a) : recentPartnerId(c);
      if (!partnerId) return { ok: false, error: 'no_partner' };
      c.blocked.add(partnerId);
      if (room) endRoom(room, c, 'blocked');
      return { ok: true, endedRoomId: room?.id || null };
    });

    on('chat:report', (c, payload) => {
      if (!REPORT_REASONS.includes(payload.reason)) return { ok: false, error: 'invalid_reason' };
      const room = roomOf(c);
      let partnerId;
      let partnerIpHash;
      let startedAt;
      if (room) {
        const partner = partnerOf(c, room);
        partnerId = partner?.id;
        partnerIpHash = partner?.ipHash;
        startedAt = room.startedAt;
      } else if (recentPartnerId(c)) {
        partnerId = c.last.partnerId;
        partnerIpHash = c.last.partnerIpHash;
        startedAt = c.last.startedAt;
      }
      if (!partnerId) return { ok: false, error: 'no_partner' };
      const lim = limits.report.take(c.id);
      if (!lim.ok) return { ok: false, error: 'rate_limited', retryAfterMs: lim.retryAfterMs };

      const endTs = room ? Date.now() : c.last.endedAt;
      reports.add({
        reason: payload.reason,
        reporterId: c.id,
        reportedId: partnerId,
        chatDurationMs: endTs - startedAt,
      });
      counters.reports += 1;
      if (partnerIpHash && partnerIpHash !== c.ipHash) recordReportAgainst(partnerIpHash, c.ipHash);
      c.blocked.add(partnerId);
      if (room) endRoom(room, c, 'reported');
      return { ok: true, endedRoomId: room?.id || null };
    });

    on('chat:rate', (c, payload) => {
      if (!['good', 'bad'].includes(payload.rating)) return { ok: false, error: 'invalid' };
      if (!c.last || c.last.roomId !== payload.roomId || c.last.rated) return { ok: false, error: 'not_allowed' };
      c.last.rated = true;
      counters.ratings[payload.rating] += 1;
      return { ok: true };
    });

    on('presence:visibility', (c, payload) => {
      c.visible = payload.visible !== false;
      return { ok: true };
    });

    on('push:subscribe', (c, payload) => {
      if (!push.enabled) return { ok: false, error: 'push_disabled' };
      if (!isValidSubscription(payload.subscription)) return { ok: false, error: 'invalid_subscription' };
      c.pushSub = {
        endpoint: payload.subscription.endpoint,
        keys: { p256dh: payload.subscription.keys.p256dh, auth: payload.subscription.keys.auth },
      };
      return { ok: true };
    });

    on('push:unsubscribe', (c) => {
      c.pushSub = null;
      return { ok: true };
    });

    socket.on('disconnect', () => {
      const c = current();
      if (!c || c.socketId !== socket.id) return; // сесс өөр socket руу шилжсэн
      c.socketId = null;
      c.visible = false;
      removeFromQueue(c);
      const room = roomOf(c);
      if (room) emitTo(partnerOf(c, room), 'chat:partner_status', { online: false });
      // Тодорхой хугацаанд эргэж холбогдохгүй бол сесс болон чатыг устгана
      const grace = c.roomId && c.pushSub && push.enabled ? config.pushGraceMs : config.reconnectGraceMs;
      c.disconnectTimer = setTimeout(() => deleteClient(c), grace);
    });
  });

  function recentPartnerId(c) {
    if (!c.last) return null;
    return Date.now() - c.last.endedAt < 5 * 60 * 1000 ? c.last.partnerId : null;
  }

  return {
    stats: () => ({ ...statsPayload(), rooms: rooms.size, ...counters }),
    /** Тестэд зориулсан дотоод төлөв */
    _internal: { clients, rooms, queues },
    close() {
      clearInterval(sweeper);
      clearInterval(statsTimer);
      clearInterval(cleanupTimer);
      for (const c of clients.values()) clearTimeout(c.disconnectTimer);
    },
  };
}
