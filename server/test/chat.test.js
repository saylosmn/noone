import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { sanitizeText } from '../src/chat.js';

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
    vapid: { publicKey: '', privateKey: '' },
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
  for (const c of clients.values()) clearTimeout(c.disconnectTimer);
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

async function join(socket, gender, interests = []) {
  const res = await emit(socket, 'queue:join', { gender, interests, adultConfirmed: true });
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

test('нэргүй сесс, санамсаргүй түр нэр олгоно', async () => {
  const s = await connect();
  assert.match(s.session.clientId, /^c_[a-f0-9]{24}$/);
  assert.ok(s.session.nickname.includes('#'));
  const r = await emit(s, 'profile:reroll');
  assert.equal(r.ok, true);
  assert.ok(r.nickname);
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
  await join(f, 'female');
  const match = await found;
  assert.ok(match.roomId);
  // Эхэлж хүлээсэн эрэгтэйтэй холбогдсон байх ёстой
  assert.equal(match.partner.nickname, m1.session.nickname);
});

test('ижил сонирхолтой хүнийг түрүүлж тааруулна', async () => {
  const early = await connect();
  const musicFan = await connect();
  await join(early, 'male', []); // эрт ирсэн, сонирхолгүй
  await join(musicFan, 'male', ['music', 'tech']);

  const f = await connect();
  const found = waitFor(f, 'match:found');
  await join(f, 'female', ['music']);
  const match = await found;
  assert.equal(match.partner.nickname, musicFan.session.nickname);
  assert.deepEqual(match.sharedInterests, ['music']);
});

test('ижил сонирхолтой хүн байхгүй бол хүлээгээд хэнтэй ч холбоно', async () => {
  const f = await connect();
  const first = waitFor(f, 'queue:status');
  await join(f, 'female', ['games']);
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

test('урт, хоосон мессеж, хяналтын тэмдэгт', () => {
  assert.equal(sanitizeText('   ', 10).error, 'empty');
  assert.equal(sanitizeText('a'.repeat(11), 10).error, 'too_long');
  assert.equal(sanitizeText('a\u0000b‮c', 10).text, 'abc');
});

test('спамын хязгаар: хэт хурдан мессеж болон давтагдсан мессеж', async () => {
  const { a } = await matchedPair();
  const results = [];
  for (let i = 0; i < 9; i += 1) results.push(await emit(a, 'chat:message', { text: `мессеж ${i}` }));
  assert.ok(results.some((r) => r.error === 'rate_limited'));
  assert.ok(results.find((r) => r.error === 'rate_limited').retryAfterMs > 0);

  const { a: a2 } = await matchedPair();
  const d1 = await emit(a2, 'chat:message', { text: 'Нэг' });
  const d2 = await emit(a2, 'chat:message', { text: 'нэг' });
  const d3 = await emit(a2, 'chat:message', { text: 'НЭГ' });
  assert.equal(d1.ok, true);
  assert.equal(d2.ok, true);
  assert.equal(d3.error, 'duplicate');
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
  await join(f2, 'female');
  assert.equal((await found).partner.nickname, f2.session.nickname);
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

  const failed = await emit(b, 'chat:message', { text: 'чи байна уу?' });
  assert.equal(failed.error, 'partner_offline');

  const online = waitFor(b, 'chat:partner_status');
  const a2 = await connect(auth);
  assert.equal(a2.session.resumed, true);
  assert.equal(a2.session.state.status, 'chatting');
  assert.deepEqual(await online, { online: true });

  const incoming = waitFor(a2, 'chat:message');
  await emit(b, 'chat:message', { text: 'буцаад ирлээ' });
  assert.equal((await incoming).text, 'буцаад ирлээ');
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
  assert.equal(push.enabled, false);
  assert.ok(push.reason.includes('VAPID'));
  const admin = await fetch(`${url}/api/admin/reports`);
  assert.equal(admin.status, 404);
});
