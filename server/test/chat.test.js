import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { sanitizeText } from '../src/chat.js';
import { maskProfanity } from '../src/profanity.js';
import { inWindow } from '../src/keepalive.js';

let server;
let url;
const sockets = [];

before(async () => {
  server = createApp({
    interestWaitMs: 400,
    reconnectGraceMs: 800,
    rematchCooldownMs: 0,
    serveClient: false,
    clientOrigins: ['*'],
    pushGraceMs: 1500,
    partnerAwayNoticeMs: 300,
    limits: { connectPerMinute: 1000 },
  });
  const addr = await server.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});

beforeEach(() => {
  for (const s of sockets.splice(0)) s.disconnect();
  const { clients, rooms, queues } = server.chat._internal;
  for (const c of clients.values()) {
    clearTimeout(c.disconnectTimer);
    clearTimeout(c.awayTimer);
  }
  clients.clear();
  rooms.clear();
  queues.male.clear();
  queues.female.clear();
});

const waitFor = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`"${event}" ирсэнгүй`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });

const expectNone = (socket, event, ms = 600) =>
  new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`"${event}" ирэх ёсгүй байсан`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload ?? {}, resolve));

async function connect(auth = {}) {
  const socket = ioClient(url, { transports: ['websocket'], auth, reconnection: false, forceNew: true });
  sockets.push(socket);
  const session = await waitFor(socket, 'session');
  socket.session = session;
  return socket;
}

async function join(socket, gender, interests = [], school = null) {
  const res = await emit(socket, 'queue:join', { gender, interests, school, adultConfirmed: true });
  assert.equal(res.ok, true, `queue:join амжилтгүй: ${res.error}`);
  return res;
}

async function matchedPair(interestsA = [], interestsB = []) {
  const a = await connect();
  const b = await connect();
  const fa = waitFor(a, 'match:found');
  const fb = waitFor(b, 'match:found');
  await join(a, 'male', interestsA);
  await join(b, 'female', interestsB);
  return { a, b, ma: await fa, mb: await fb };
}

test('нэргүй сесс; нөгөө хүн "Нууц нэгэн" гэж харагдана', async () => {
  const s = await connect();
  assert.match(s.session.clientId, /^c_[a-f0-9]{24}$/);
  assert.equal(s.session.nickname, undefined);
  const { ma, mb } = await matchedPair();
  assert.equal(ma.partner.nickname, 'Нууц нэгэн');
  assert.equal(mb.partner.nickname, 'Нууц нэгэн');
});

test('18+ баталгаажуулалтгүйгээр дараалалд орохгүй', async () => {
  const s = await connect();
  const r = await emit(s, 'queue:join', { gender: 'male', interests: [] });
  assert.equal(r.error, 'adult_confirmation_required');
  const bad = await emit(s, 'queue:join', { gender: 'other', adultConfirmed: true });
  assert.equal(bad.error, 'invalid_gender');
});

test('ижил хүйстэнг холбохгүй, эсрэг хүйсийг холбоно', async () => {
  const m1 = await connect();
  const m2 = await connect();
  await join(m1, 'male');
  await join(m2, 'male');
  await expectNone(m1, 'match:found', 700);

  const f = await connect();
  const found = waitFor(f, 'match:found');
  const m1Found = waitFor(m1, 'match:found');
  const m2None = expectNone(m2, 'match:found', 700);
  await join(f, 'female');
  const match = await found;
  assert.ok(match.roomId);
  // Эхэлж хүлээсэн эрэгтэйтэй холбогдсон байх ёстой
  assert.equal((await m1Found).roomId, match.roomId);
  await m2None;
});

test('ижил сонирхолтой хүнийг түрүүлж тааруулна', async () => {
  const early = await connect();
  const musicFan = await connect();
  await join(early, 'male', []); // эрт ирсэн, сонирхолгүй
  await join(musicFan, 'male', ['music', 'tech']);

  const f = await connect();
  const found = waitFor(f, 'match:found');
  const fanFound = waitFor(musicFan, 'match:found');
  await join(f, 'female', ['music', 'cs2']);
  const match = await found;
  assert.equal((await fanFound).roomId, match.roomId);
  assert.deepEqual(match.sharedInterests, ['music']);
});

test('ижил сонирхолтой хүн байхгүй бол хүлээгээд хэнтэй ч холбоно', async () => {
  const f = await connect();
  const first = waitFor(f, 'queue:status');
  await join(f, 'female', ['cs2']);
  assert.equal((await first).phase, 'interest');
  assert.equal((await waitFor(f, 'queue:status', 2000)).phase, 'anyone');

  const m = await connect();
  const found = waitFor(f, 'match:found', 3000);
  const startedWaiting = Date.now();
  await join(m, 'male', ['sports']);
  const match = await found;
  assert.deepEqual(match.sharedInterests, []);
  // Шинээр ирсэн хүн ч мөн ижил сонирхолтой хүн хүлээх хугацааг өнгөрүүлнэ
  assert.ok(Date.now() - startedWaiting >= 300);
});

test('мессеж, reply, typing бодит цагт дамжина', async () => {
  const { a, b } = await matchedPair();
  const typing = waitFor(b, 'chat:typing');
  await emit(a, 'chat:typing', { typing: true });
  assert.deepEqual(await typing, { typing: true });

  const incoming = waitFor(b, 'chat:message');
  const sent = await emit(a, 'chat:message', { text: '  Сайн уу?  ' });
  assert.equal(sent.ok, true);
  const msg = await incoming;
  assert.equal(msg.text, 'Сайн уу?');
  assert.equal(msg.id, sent.id);
  assert.equal(msg.replyTo, null);

  const replyIncoming = waitFor(a, 'chat:message');
  const reply = await emit(b, 'chat:message', { text: 'Сайн, сайн байна уу', replyTo: sent.id });
  assert.equal(reply.ok, true);
  const replyMsg = await replyIncoming;
  assert.equal(replyMsg.replyTo, sent.id);

  const forged = waitFor(a, 'chat:message');
  await emit(b, 'chat:message', { text: 'тест', replyTo: '<script>' });
  assert.equal((await forged).replyTo, null);
});

test('мессежийн агуулга серверт хадгалагдахгүй', async () => {
  const { a } = await matchedPair();
  await emit(a, 'chat:message', { text: 'нууц-тест-12345' });
  const dump = JSON.stringify(
    [...server.chat._internal.clients.values()].map((c) => ({ ...c, blocked: [...c.blocked], recent: [...c.recent], disconnectTimer: null })),
  ) + JSON.stringify([...server.chat._internal.rooms.values()]);
  assert.ok(!dump.includes('нууц-тест-12345'));
});

test('"Харсан" тэмдэг нөгөө хүнд дамжина', async () => {
  const { a, b } = await matchedPair();
  const sent = await emit(a, 'chat:message', { text: 'уншсан уу?' });
  const seen = waitFor(a, 'chat:seen');
  assert.equal((await emit(b, 'chat:seen', { messageId: sent.id })).ok, true);
  assert.deepEqual(await seen, { messageId: sent.id });
  assert.equal((await emit(b, 'chat:seen', { messageId: 'буруу' })).error, 'invalid');
});

test('мессеж буцаах: зөвхөн өөрийнхөө, 1 минутын дотор', async () => {
  const { a, b } = await matchedPair();
  const sent = await emit(a, 'chat:message', { text: 'буцаах гэж байна' });
  const unsent = waitFor(b, 'chat:unsent');
  assert.equal((await emit(a, 'chat:unsend', { messageId: sent.id })).ok, true);
  assert.deepEqual(await unsent, { messageId: sent.id });
  // Дахин буцаах, бусдын мессежийг буцаах боломжгүй
  assert.equal((await emit(a, 'chat:unsend', { messageId: sent.id })).error, 'unsend_expired');
  const other = await emit(b, 'chat:message', { text: 'миний мессеж' });
  assert.equal((await emit(a, 'chat:unsend', { messageId: other.id })).error, 'unsend_expired');
  // 1 минут өнгөрсөн бол
  const old = await emit(a, 'chat:message', { text: 'хуучин мессеж' });
  const client = server.chat._internal.clients.get(a.session.clientId);
  client.sent.set(old.id, Date.now() - 61 * 1000);
  assert.equal((await emit(a, 'chat:unsend', { messageId: old.id })).error, 'unsend_expired');
});

test('холболт тасарсан үед буцаасан мессеж дахин холбогдоход мэдэгдэнэ', async () => {
  const { a, b } = await matchedPair();
  const sent = await emit(a, 'chat:message', { text: 'алдаатай мессеж' });
  const auth = { clientId: b.session.clientId, resumeToken: b.session.resumeToken };
  const offline = waitFor(a, 'chat:partner_status');
  b.disconnect();
  await offline;
  assert.equal((await emit(a, 'chat:unsend', { messageId: sent.id })).ok, true);
  const b2 = ioClient(url, { transports: ['websocket'], auth, reconnection: false, forceNew: true });
  sockets.push(b2);
  const unsent = waitFor(b2, 'chat:unsent');
  assert.equal((await waitFor(b2, 'session')).resumed, true);
  assert.deepEqual(await unsent, { messageId: sent.id });
});

test('урт, хоосон мессеж, хяналтын тэмдэгт', () => {
  assert.equal(sanitizeText('   ', 10).error, 'empty');
  assert.equal(sanitizeText('a'.repeat(11), 10).error, 'too_long');
  assert.equal(sanitizeText('a\u0000b‮c', 10).text, 'abc');
});

test('спамын хязгаар: хэт хурдан мессеж болон давтагдсан мессеж', async () => {
  const { a } = await matchedPair();
  const results = [];
  for (let i = 0; i < 14; i += 1) results.push(await emit(a, 'chat:message', { text: `мессеж ${i}` }));
  // Эхний 10 нь дамжина, дараа нь хязгаарлагдана
  assert.ok(results.slice(0, 10).every((r) => r.ok));
  assert.ok(results.some((r) => r.error === 'rate_limited'));
  assert.ok(results.find((r) => r.error === 'rate_limited').retryAfterMs > 0);

  const { a: a2 } = await matchedPair();
  const d1 = await emit(a2, 'chat:message', { text: 'Нэг' });
  const d2 = await emit(a2, 'chat:message', { text: 'нэг' });
  const d3 = await emit(a2, 'chat:message', { text: 'НЭГ' });
  const d4 = await emit(a2, 'chat:message', { text: 'нэг ' });
  assert.equal(d1.ok, true);
  assert.equal(d2.ok, true);
  assert.equal(d3.ok, true);
  assert.equal(d4.error, 'duplicate');
});

test('"Дараагийн хүн": нөгөөд нь мэдэгдэж, өөрөө дахин дараалалд орно', async () => {
  const { a, b, ma } = await matchedPair();
  const ended = waitFor(b, 'chat:ended');
  const res = await emit(a, 'chat:next');
  assert.equal(res.ok, true);
  assert.equal(res.endedRoomId, ma.roomId);
  assert.equal(res.status, 'queued');
  assert.equal((await ended).reason, 'partner_left');

  const f2 = await connect();
  const found = waitFor(a, 'match:found');
  const f2Found = waitFor(f2, 'match:found');
  await join(f2, 'female');
  assert.equal((await found).roomId, (await f2Found).roomId);
});

test('блоклосон хүнтэй дахин холбогдохгүй', async () => {
  const { a, b } = await matchedPair();
  const ended = waitFor(b, 'chat:ended');
  const r = await emit(a, 'chat:block');
  assert.equal(r.ok, true);
  assert.equal((await ended).reason, 'partner_left'); // блоклосныг ил гаргахгүй
  await join(a, 'male');
  await join(b, 'female');
  await expectNone(a, 'match:found', 1200);
});

test('мэдээлэх: шалтгаантай, хамгийн бага мэдээлэл бүртгэнэ, дахин холбохгүй', async () => {
  const { a, b } = await matchedPair();
  await emit(a, 'chat:message', { text: 'энэ мессеж report-д орох ёсгүй' });
  const invalid = await emit(b, 'chat:report', { reason: 'whatever' });
  assert.equal(invalid.error, 'invalid_reason');

  const before = server.reports.count();
  const ended = waitFor(a, 'chat:ended');
  const r = await emit(b, 'chat:report', { reason: 'harassment' });
  assert.equal(r.ok, true);
  await ended;
  assert.equal(server.reports.count(), before + 1);
  const entry = server.reports.list()[0];
  assert.deepEqual(Object.keys(entry).sort(), ['at', 'chatDurationSec', 'id', 'reason', 'reported', 'reporter']);
  assert.equal(entry.reason, 'harassment');
  assert.ok(!JSON.stringify(entry).includes('мессеж'));
  assert.ok(!JSON.stringify(entry).includes(a.session.clientId));

  await join(a, 'male');
  await join(b, 'female');
  await expectNone(a, 'match:found', 1200);
});

test('чат дууссаны дараа үнэлгээ нэг л удаа', async () => {
  const { a, b, ma } = await matchedPair();
  await emit(a, 'chat:leave');
  await waitFor(b, 'chat:ended').catch(() => {});
  const r1 = await emit(b, 'chat:rate', { roomId: ma.roomId, rating: 'good' });
  const r2 = await emit(b, 'chat:rate', { roomId: ma.roomId, rating: 'good' });
  assert.equal(r1.ok, true);
  assert.equal(r2.error, 'not_allowed');
});

test('холболт тасарвал нөгөөд нь мэдэгдэж, дахин холбогдоход чат үргэлжилнэ', async () => {
  const { a, b } = await matchedPair();
  const auth = { clientId: a.session.clientId, resumeToken: a.session.resumeToken };
  const offline = waitFor(b, 'chat:partner_status');
  a.disconnect();
  assert.deepEqual(await offline, { online: false });

  // Түр гарсан хүнд илгээсэн мессеж буцаж ороход нь хүргэгдэнэ
  const buffered = await emit(b, 'chat:message', { text: 'чи байна уу?' });
  assert.equal(buffered.ok, true);

  const online = waitFor(b, 'chat:partner_status');
  const a2 = await connect(auth);
  assert.equal(a2.session.resumed, true);
  assert.equal(a2.session.state.status, 'chatting');
  assert.deepEqual(await online, { online: true });

  assert.equal((await waitFor(a2, 'chat:message')).text, 'чи байна уу?');
  const incoming = waitFor(a2, 'chat:message');
  await emit(b, 'chat:message', { text: 'буцаад ирлээ' });
  assert.equal((await incoming).text, 'буцаад ирлээ');
});

test('2 минут болохоос өмнө буцаж ирвэл нөгөө хүнд "гарсан" гэж огт мэдэгдэхгүй', async () => {
  const { a, b } = await matchedPair();
  const auth = { clientId: a.session.clientId, resumeToken: a.session.resumeToken };
  const none = expectNone(b, 'chat:partner_status', 500);
  a.disconnect();
  await new Promise((r) => setTimeout(r, 100));
  const a2 = await connect(auth);
  assert.equal(a2.session.state.status, 'chatting');
  await none;
});

test('буруу resumeToken-оор бусдын сессийг авч чадахгүй', async () => {
  const { a } = await matchedPair();
  const thief = await connect({ clientId: a.session.clientId, resumeToken: 'x'.repeat(48) });
  assert.notEqual(thief.session.clientId, a.session.clientId);
  assert.equal(thief.session.resumed, false);
});

test('хугацаандаа эргэж ирэхгүй бол чат дуусна', async () => {
  const { a, b } = await matchedPair();
  const ended = waitFor(b, 'chat:ended', 3000);
  a.disconnect();
  assert.equal((await ended).reason, 'partner_disconnected');
});

test('health болон push config API', async () => {
  const health = await fetch(`${url}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  const push = await fetch(`${url}/api/push/config`).then((r) => r.json());
  assert.equal(push.enabled, true); // түлхүүрийг сервер өөрөө үүсгэнэ
  assert.ok(push.publicKey.length > 40);
  const admin = await fetch(`${url}/api/admin/reports`);
  assert.equal(admin.status, 404);
});

test('нэг сургуулийнхныг ижил сонирхлоос ч түрүүлж холбоно', async () => {
  const interestFan = await connect();
  const schoolmate = await connect();
  await join(interestFan, 'male', ['music', 'tech']);
  await join(schoolmate, 'male', [], 'must');
  const f = await connect();
  const found = waitFor(f, 'match:found');
  const mateFound = waitFor(schoolmate, 'match:found');
  await join(f, 'female', ['music'], 'must');
  const match = await found;
  assert.equal((await mateFound).roomId, match.roomId);
  assert.equal(match.sharedSchool, 'must');
  const bad = await connect();
  const r = await emit(bad, 'queue:join', { gender: 'male', school: 'hack', adultConfirmed: true });
  assert.equal(r.ok, true); // буруу сургууль үл тоогдоно
});

test('ШУТИС: нэг салбарынхныг түрүүлж, дараа нь ШУТИС-ийн өөр салбарынхныг холбоно', async () => {
  const otherSub = await connect();
  const sameSub = await connect();
  await join(otherSub, 'male', [], 'must-bas');
  await join(sameSub, 'male', [], 'must-mhts');
  const f = await connect();
  const found = waitFor(f, 'match:found');
  const sameFound = waitFor(sameSub, 'match:found');
  await join(f, 'female', [], 'must-mhts');
  const m1 = await found;
  assert.equal((await sameFound).roomId, m1.roomId);
  assert.equal(m1.sharedSchool, 'must-mhts');

  const f2 = await connect();
  const found2 = waitFor(f2, 'match:found');
  await join(f2, 'female', [], 'must-ehs');
  assert.equal((await found2).sharedSchool, 'must'); // нэг их сургууль, өөр салбар
});

test('стикер илгээх, буруу стикер татгалзах', async () => {
  const { a, b } = await matchedPair();
  const incoming = waitFor(b, 'chat:message');
  const r = await emit(a, 'chat:message', { sticker: 'haha' });
  assert.equal(r.ok, true);
  const msg = await incoming;
  assert.equal(msg.sticker, 'haha');
  assert.equal(msg.text, undefined);
  const bad = await emit(a, 'chat:message', { sticker: 'evil' });
  assert.equal(bad.error, 'invalid');
});

test('хараалын үг "***" болж хүрнэ, илгээгчид ч буцаана', async () => {
  const { a, b } = await matchedPair();
  const incoming = waitFor(b, 'chat:message');
  const r = await emit(a, 'chat:message', { text: 'fuck чи новш' });
  assert.equal((await incoming).text, 'f*** чи н***');
  assert.equal(r.text, 'f*** чи н***');
  const clean = await emit(a, 'chat:message', { text: 'Сайн байна уу' });
  assert.equal(clean.text, undefined);
  assert.equal(maskProfanity('Dickens сайн').text, 'Dickens сайн');
});

test('reaction нөгөө хүнд дамжина', async () => {
  const { a, b } = await matchedPair();
  const sent = await emit(a, 'chat:message', { text: 'хаха' });
  const reaction = waitFor(a, 'chat:reaction');
  const r = await emit(b, 'chat:react', { messageId: sent.id, emoji: '😂' });
  assert.equal(r.ok, true);
  assert.deepEqual(await reaction, { messageId: sent.id, emoji: '😂' });
  const removed = waitFor(a, 'chat:reaction');
  await emit(b, 'chat:react', { messageId: sent.id, emoji: null });
  assert.equal((await removed).emoji, null);
  assert.equal((await emit(b, 'chat:react', { messageId: sent.id, emoji: '💩' })).error, 'invalid');
});

test('найз болох: хоёулаа зөвшөөрсөн үед л хаягаа солилцоно', async () => {
  const { a, b } = await matchedPair();
  const requested = waitFor(b, 'friend:requested');
  const r1 = await emit(a, 'friend:offer', { platform: 'instagram', handle: ' @boldoo_01 ' });
  assert.equal(r1.status, 'waiting');
  assert.equal(r1.contact, undefined);
  const req = await requested;
  assert.deepEqual(req, {}); // хаяг нь ил гарахгүй
  const invalid = await emit(b, 'friend:offer', { platform: 'phone', handle: '99112233' });
  assert.equal(invalid.error, 'invalid_platform');

  const revealA = waitFor(a, 'friend:reveal');
  const r2 = await emit(b, 'friend:offer', { platform: 'telegram', handle: 'saraa' });
  assert.equal(r2.status, 'revealed');
  assert.deepEqual(r2.contact, { platform: 'instagram', handle: '@boldoo_01' });
  assert.deepEqual((await revealA).contact, { platform: 'telegram', handle: 'saraa' });
  assert.equal((await emit(a, 'friend:cancel')).error, 'not_allowed');
});

test('найз болох хүсэлтийг цуцалж болно, чат дуусахад устна', async () => {
  const { a, b, ma } = await matchedPair();
  await emit(a, 'friend:offer', { platform: 'discord', handle: 'bat#1234' });
  const cancelled = waitFor(b, 'friend:cancelled');
  assert.equal((await emit(a, 'friend:cancel')).ok, true);
  await cancelled;
  await emit(a, 'friend:offer', { platform: 'discord', handle: 'bat#1234' });
  await emit(a, 'chat:leave');
  assert.equal(server.chat._internal.rooms.has(ma.roomId), false);
});

test('keep-alive цагийн цонх (UB цагаар)', () => {
  const at = (ubHour) => new Date(Date.UTC(2026, 0, 1, (ubHour - 8 + 24) % 24));
  assert.equal(inWindow(at(9), '8-2'), true);
  assert.equal(inWindow(at(1), '8-2'), true);
  assert.equal(inWindow(at(4), '8-2'), false);
  assert.equal(inWindow(at(4), '0-0'), true);
});

test('push: апп хаалттай үед мессеж түр хадгалагдаж, push илгээгдээд, буцаж ороход хүргэгдэнэ', async () => {
  const sent = [];
  const origSend = server.push.send;
  server.push.send = async (sub, payload) => {
    sent.push(payload);
    return 'sent';
  };
  try {
    const { a, b } = await matchedPair();
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test123', keys: { p256dh: 'x'.repeat(80), auth: 'y'.repeat(20) } };
    assert.equal((await emit(b, 'push:subscribe', { subscription: sub })).ok, true);
    const auth = { clientId: b.session.clientId, resumeToken: b.session.resumeToken };
    const offline = waitFor(a, 'chat:partner_status');
    b.disconnect();
    await offline;
    const r1 = await emit(a, 'chat:message', { text: 'чи хаана байна?' });
    const r2 = await emit(a, 'chat:message', { sticker: 'hi' });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].body, 'Шинэ мессеж ирлээ'); // агуулга орохгүй
    assert.ok(!JSON.stringify(sent).includes('хаана'));

    const b2 = await connect(auth);
    assert.equal(b2.session.state.status, 'chatting');
    const got = [];
    await new Promise((resolve) => {
      b2.on('chat:message', (m) => {
        got.push(m);
        if (got.length === 2) resolve();
      });
    });
    assert.equal(got[0].text, 'чи хаана байна?');
    assert.equal(got[1].sticker, 'hi');
    const c = server.chat._internal.clients.get(b.session.clientId);
    assert.equal(c.pending.length, 0);
  } finally {
    server.push.send = origSend;
  }
});

test('push-гүй хэрэглэгч түр гарсан ч мессеж хадгалагдаж, push илгээхгүй', async () => {
  const { a, b } = await matchedPair();
  const offline = waitFor(a, 'chat:partner_status');
  b.disconnect();
  await offline;
  assert.equal((await emit(a, 'chat:message', { text: 'сайн уу' })).ok, true);
  assert.equal(server.chat._internal.clients.get(b.session.clientId).pending.length, 1);
});

// ---------- Дууны дуудлага (signaling) ----------
const SDP = `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n`;

test('дуудлага: invite → accept → offer/answer/ice нөгөө хүнд дамжина', async () => {
  const { a, b } = await matchedPair();
  const gotInvite = waitFor(b, 'call:signal');
  assert.equal((await emit(a, 'call:signal', { kind: 'invite' })).ok, true);
  assert.deepEqual(await gotInvite, { kind: 'invite' });

  const gotAccept = waitFor(a, 'call:signal');
  await emit(b, 'call:signal', { kind: 'accept' });
  assert.deepEqual(await gotAccept, { kind: 'accept' });

  const gotOffer = waitFor(b, 'call:signal');
  await emit(a, 'call:signal', { kind: 'offer', sdp: SDP });
  assert.deepEqual(await gotOffer, { kind: 'offer', sdp: SDP });

  const gotAnswer = waitFor(a, 'call:signal');
  await emit(b, 'call:signal', { kind: 'answer', sdp: SDP });
  assert.equal((await gotAnswer).kind, 'answer');

  const gotIce = waitFor(b, 'call:signal');
  await emit(a, 'call:signal', {
    kind: 'ice',
    candidate: { candidate: 'candidate:1 1 udp 2122 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0, extra: 'x' },
  });
  assert.deepEqual(await gotIce, {
    kind: 'ice',
    candidate: { candidate: 'candidate:1 1 udp 2122 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });

  const gotEnd = waitFor(a, 'call:signal');
  await emit(b, 'call:signal', { kind: 'end' });
  assert.deepEqual(await gotEnd, { kind: 'end' });
});

test('дуудлага: буруу/том signal-ийг дамжуулахгүй, чатгүй хүн илгээж чадахгүй', async () => {
  const { a, b } = await matchedPair();
  assert.equal((await emit(a, 'call:signal', { kind: 'hack' })).error, 'invalid');
  assert.equal((await emit(a, 'call:signal', { kind: 'offer', sdp: 'v=0'.padEnd(13000, 'x') })).error, 'invalid');
  assert.equal((await emit(a, 'call:signal', { kind: 'offer', sdp: 'not an sdp at all, really not' })).error, 'invalid');
  assert.equal((await emit(a, 'call:signal', { kind: 'ice', candidate: { candidate: 'x'.repeat(700) } })).error, 'invalid');
  assert.equal((await emit(a, 'call:signal', { kind: 'ice', candidate: { candidate: 'c', sdpMLineIndex: 99 } })).error, 'invalid');
  await expectNone(b, 'call:signal');

  const lone = await connect();
  assert.equal((await emit(lone, 'call:signal', { kind: 'invite' })).error, 'not_in_chat');
});

test('дуудлага: invite-ийг хурдан давтаж чадахгүй', async () => {
  const { a } = await matchedPair();
  for (let i = 0; i < 4; i += 1) assert.equal((await emit(a, 'call:signal', { kind: 'invite' })).ok, true);
  assert.equal((await emit(a, 'call:signal', { kind: 'invite' })).error, 'rate_limited');
});
