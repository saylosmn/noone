import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connectSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { blindDateWindow, sanitizeDateProfile } from '../src/blindDate.js';

const at = s => Date.parse(s + '+08:00');
const emit = (s, event, payload = {}) => new Promise((resolve, reject) => s.timeout(2000).emit(event, payload, (err, data) => err ? reject(err) : resolve(data)));
const once = (s, event) => new Promise((resolve, reject) => {
  const handler = data => { clearTimeout(timer); resolve(data); };
  const timer = setTimeout(() => { s.off(event, handler); reject(new Error(`Missing ${event}`)); }, 2500);
  s.once(event, handler);
});

async function setup(t, initial = at('2026-10-29T21:00:00')) {
  let now = initial;
  const server = createApp({ now: () => now, serveClient: false, clientOrigins: ['*'], adminToken: 'local-test-admin', interestWaitMs: 60000, rematchCooldownMs: 0 });
  const address = await server.listen(0, '127.0.0.1');
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach(s => s.disconnect()); await server.close(); });
  const connect = async (auth = {}) => {
    const s = connectSocket(url, { transports: ['websocket'], auth, forceNew: true, reconnection: false });
    sockets.push(s); s.session = await once(s, 'session');
    return s;
  };
  const join = (s, gender, mode = 'blind', interests = []) => emit(s, 'queue:join', { gender, mode, interests, adultConfirmed: true });
  const pair = async () => {
    const a = await connect(), b = await connect();
    const ma = once(a, 'match:found'), mb = once(b, 'match:found');
    assert.equal((await join(a, 'male')).ok, true);
    assert.equal((await join(b, 'female')).ok, true);
    return { a, b, room: await ma, other: await mb };
  };
  return { server, url, connect, join, pair, clock: value => { now = value; } };
}

test('daily Ulaanbaatar schedule includes midnight and excludes 04:00 precisely', () => {
  for (const [time, expected] of [['19:59:59', false], ['20:00:00', true], ['23:59:59', true], ['00:00:00', true], ['03:59:59', true], ['04:00:00', false]]) {
    assert.equal(blindDateWindow(at(`2026-10-29T${time}`)).open, expected, time);
  }
  const midnight = blindDateWindow(at('2026-10-30T00:00:00'));
  assert.equal(midnight.startsAt, at('2026-10-29T20:00:00'));
  assert.equal(midnight.endsAt, at('2026-10-30T04:00:00'));
  assert.equal(blindDateWindow(at('2026-10-30T04:00:00')).nextStartsAt, at('2026-10-30T20:00:00'));
});

test('closed event rejects blind joins, ordinary chat still works, adult consent required', async t => {
  const { connect, join } = await setup(t, at('2026-10-29T12:00:00'));
  const a = await connect();
  assert.equal((await join(a, 'male')).error, 'date_closed');
  assert.equal((await emit(a, 'queue:join', { gender: 'male' })).error, 'adult_confirmation_required');
  assert.equal((await join(a, 'male', 'chat')).ok, true);
});

test('normal and blind queues never mix; broaden keeps mode and queue position', async t => {
  const { server, connect, join } = await setup(t);
  const a = await connect(), normal = await connect(), b = await connect();
  await join(a, 'male', 'blind', ['music']);
  await join(normal, 'female', 'chat');
  assert.equal(server.chat.stats().rooms, 0);
  await join(b, 'female', 'blind', ['sports']);
  assert.equal(server.chat.stats().rooms, 0);
  const before = server.chat._internal.clients.get(a.session.clientId).queuedAt;
  await emit(a, 'queue:broaden');
  assert.equal(server.chat._internal.clients.get(a.session.clientId).queuedAt, before);
  const matched = once(a, 'match:found');
  await emit(b, 'queue:broaden');
  assert.equal((await matched).mode, 'blind');
  assert.equal(server.chat._internal.clients.get(normal.session.clientId).status, 'queued');
});

test('mutual stages, private votes, cancellation, reconnect, profile consent and final friend exchange', async t => {
  const { server, pair, connect } = await setup(t);
  let { a, b, room } = await pair();
  assert.equal(room.blind.stage, 'icebreaker');
  assert.equal(room.blind.question.length > 0, true);
  assert.equal((await emit(a, 'friend:offer', { platform: 'instagram', handle: 'test_a' })).error, 'date_locked');
  assert.equal((await emit(a, 'call:signal', { kind: 'invite' })).error, 'date_locked');
  const advance = (s, stage, ready = true) => emit(s, 'date:advance', { roomId: room.roomId, stage, ready });
  const privateState = once(b, 'date:state');
  await advance(a, 'icebreaker');
  const state = await privateState;
  assert.equal(state.blind.ready, false);
  assert.equal(state.blind.stage, 'icebreaker');
  assert.equal(state.blind.partnerReady, undefined);
  await advance(a, 'icebreaker', false);
  await advance(b, 'icebreaker');
  assert.equal(server.chat._internal.rooms.get(room.roomId).blind.stage, 'icebreaker');
  await advance(a, 'icebreaker');
  assert.equal((await advance(a, 'icebreaker')).error, 'date_stale');
  await advance(a, 'text');
  const auth = a.session;
  a.disconnect();
  a = await connect({ clientId: auth.clientId, resumeToken: auth.resumeToken });
  assert.equal(a.session.state.room.blind.stage, 'text');
  assert.equal(a.session.state.room.blind.ready, true);
  await advance(b, 'text');
  const call = once(b, 'call:signal');
  assert.equal((await emit(a, 'call:signal', { kind: 'invite' })).ok, true);
  assert.equal((await call).kind, 'invite');
  await advance(a, 'voice'); await advance(b, 'voice');
  const profile = (s, fields) => emit(s, 'date:profile', { roomId: room.roomId, ...fields });
  const hidden = once(b, 'date:state');
  assert.equal((await profile(a, { name: 'Test A' })).ok, true);
  assert.equal((await hidden).blind.partnerProfile, null);
  await profile(a, { cancel: true });
  const stillHidden = once(a, 'date:state');
  await profile(b, { name: 'Test B' });
  assert.equal((await stillHidden).blind.partnerProfile, null);
  const revealed = once(a, 'date:state');
  await profile(a, { name: 'Test A' });
  assert.equal((await revealed).blind.partnerProfile.name, 'Test B');
  assert.equal((await profile(a, { cancel: true })).error, 'already_revealed');
  await advance(a, 'reveal'); await advance(b, 'reveal');
  const first = await emit(a, 'friend:offer', { platform: 'instagram', handle: 'test_a' });
  assert.equal(first.status, 'waiting'); assert.equal(first.contact, undefined);
  const second = await emit(b, 'friend:offer', { platform: 'instagram', handle: 'test_b' });
  assert.equal(second.status, 'revealed'); assert.equal(second.contact.handle, 'test_a');
  assert.equal(server.chat.stats().dateMetrics.completed, 1);
  assert.equal(server.chat.stats().dateMetrics.mutualSteps, 4);
  await emit(a, 'chat:leave');
  assert.equal(server.chat._internal.rooms.has(room.roomId), false);
  assert.equal((await advance(b, 'connect')).error, 'date_stale');
});

test('at 04:00 queues close but existing dates and mutual progression survive', async t => {
  const { pair, connect, join, clock, server } = await setup(t, at('2026-10-30T03:59:59'));
  const { a, b, room } = await pair();
  const c = await connect(); await join(c, 'male');
  const closed = once(c, 'queue:closed');
  clock(at('2026-10-30T04:00:00'));
  assert.equal((await closed).reason, 'date_closed');
  assert.equal(server.chat._internal.clients.get(c.session.clientId).status, 'idle');
  const msg = once(b, 'chat:message');
  assert.equal((await emit(a, 'chat:message', { text: 'Still here' })).ok, true);
  assert.equal((await msg).text, 'Still here');
  for (const s of [a, b]) assert.equal((await emit(s, 'date:advance', { roomId: room.roomId, stage: 'icebreaker', ready: true })).ok, true);
  assert.equal((await emit(a, 'chat:next')).error, 'date_closed');
});

test('profiles reject oversized/external/executable images; stats require admin', async t => {
  for (const photo of ['https://example.com/a.jpg', 'data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(120000)]) {
    assert.equal(sanitizeDateProfile({ name: 'Test', photo }), null);
  }
  assert.equal(sanitizeDateProfile({ name: '\u202eTest' }), null);
  assert.deepEqual(sanitizeDateProfile({ name: ' Test ' }), { name: 'Test', photo: null });
  const { url } = await setup(t);
  assert.equal((await fetch(`${url}/api/admin/chat-stats`)).status, 404);
  const response = await fetch(`${url}/api/admin/chat-stats`, { headers: { Authorization: 'Bearer local-test-admin' } });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(await response.json()), ['dateMetrics']);
});
