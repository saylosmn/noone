import { test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connectSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { blindDateWindow } from '../src/blindDate.js';

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

test('four alternating questions, visible answers, facts, flags, reconnect and mutual finish', async t => {
  const { server, pair, connect } = await setup(t);
  let { a, b, room } = await pair();
  const action = (s, event, fields = {}) => emit(s, `date:${event}`, { roomId: room.roomId, ...fields });
  assert.equal((await emit(a, 'chat:message', { text: 'skip' })).error, 'date_locked');
  for (let round = 0; round < 4; round++) {
    const chooser = round % 2 ? b : a, other = round % 2 ? a : b;
    assert.equal((await action(other, 'question', { round, question: round })).ok, false);
    const selected = once(other, 'date:state');
    assert.equal((await action(chooser, 'question', { round, question: round })).ok, true);
    assert.equal((await selected).blind.rounds[round].question.length > 0, true);
    const visible = once(b, 'date:state');
    await action(a, 'answer', { round, answer: `Male answer ${round}` });
    assert.equal((await visible).blind.rounds[round].answers.male, `Male answer ${round}`);
    assert.equal((await action(a, 'answer', { round, answer: 'duplicate' })).ok, false);
    assert.equal((await action(a, 'facts', { values: ['a','b','c','d','e'] })).ok, false);
    await action(b, 'answer', { round, answer: `Female answer ${round}` });
  }
  assert.equal(server.chat._internal.rooms.get(room.roomId).blind.stage, 'facts');
  assert.equal((await action(a, 'facts', { values: ['one'] })).ok, false);
  await action(a, 'facts', { values: ['1','2','3','4','5'] });
  assert.equal(server.chat._internal.rooms.get(room.roomId).blind.stage, 'facts');
  const auth = a.session; a.disconnect();
  a = await connect({ clientId: auth.clientId, resumeToken: auth.resumeToken });
  assert.equal(a.session.state.room.blind.rounds.length, 4);
  assert.equal(a.session.state.room.blind.facts.male.length, 5);
  await action(b, 'facts', { values: ['a','b','c','d','e'] });
  await action(a, 'flags', { values: ['green','red','like','dislike'] });
  assert.equal(server.chat._internal.rooms.get(room.roomId).blind.stage, 'flags');
  await action(b, 'flags', { values: ['green','red','like','dislike'] });
  assert.equal(server.chat._internal.rooms.get(room.roomId).blind.stage, 'free');
  assert.equal((await emit(a, 'chat:message', { text: 'Hello freely' })).ok, true);
  await action(a, 'finish', { ready: true });
  assert.equal(server.chat._internal.rooms.has(room.roomId), true);
  await action(a, 'finish', { ready: false });
  await action(b, 'finish', { ready: true });
  assert.equal(server.chat._internal.rooms.has(room.roomId), true);
  const endedA = once(a, 'chat:ended'), endedB = once(b, 'chat:ended');
  await action(a, 'finish', { ready: true });
  assert.equal((await endedA).reason, 'date_completed');
  assert.equal((await endedB).reason, 'date_completed');
  assert.equal(server.chat._internal.rooms.has(room.roomId), false);
});

test('at 04:00 queues close but existing dates and mutual progression survive', async t => {
  const { pair, connect, join, clock, server } = await setup(t, at('2026-10-30T03:59:59'));
  const { a, b, room } = await pair();
  const c = await connect(); await join(c, 'male');
  const closed = once(c, 'queue:closed');
  clock(at('2026-10-30T04:00:00'));
  assert.equal((await closed).reason, 'date_closed');
  assert.equal(server.chat._internal.clients.get(c.session.clientId).status, 'idle');
  assert.equal((await emit(a, 'date:question', { roomId: room.roomId, round: 0, question: 0 })).ok, true);
  for (const socket of [a,b]) assert.equal((await emit(socket, 'date:answer', { roomId: room.roomId, round: 0, answer: 'still here' })).ok, true);
  assert.equal((await emit(a, 'chat:next')).error, 'date_closed');
});

test('stats require admin', async t => {
  const { url } = await setup(t);
  assert.equal((await fetch(`${url}/api/admin/chat-stats`)).status, 404);
  const response = await fetch(`${url}/api/admin/chat-stats`, { headers: { Authorization: 'Bearer local-test-admin' } });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(await response.json()), ['dateMetrics']);
});
