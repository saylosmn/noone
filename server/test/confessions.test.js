import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { containsContactInfo } from '../src/confessions.js';

let server;
let url;
const devA = `d_${'a'.repeat(32)}`;
const devB = `d_${'b'.repeat(32)}`;
const devC = `d_${'c'.repeat(32)}`;

before(async () => {
  server = createApp({ serveClient: false, clientOrigins: ['*'], adminToken: 'secret', adminPassword: '12345' });
  await server.confessions.ready;
  const addr = await server.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  const { items, recentHashes, limits, bans } = server.confessions._internal;
  items.clear();
  recentHashes.clear();
  bans.clear();
  for (const l of Object.values(limits)) l.buckets.clear();
});

const api = async (path, { method = 'GET', body, device } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (device) headers['X-Noone-Device'] = device;
  const res = await fetch(`${url}/api/confessions${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const adminApi = async (path, { method = 'GET', body, token = 'secret' } = {}) => {
  const res = await fetch(`${url}/api/admin/confessions${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const post = (text, device = devA, extra = {}) =>
  api('', { method: 'POST', device, body: { text, adultConfirmed: true, tag: 'love', ...extra } });

test('confession бичиж, жагсаалтад гарна', async () => {
  const r = await post('Ангийнхаа нэг охинд гурван жил нууцаар дурласан', devA, { school: 'must-mhts' });
  assert.equal(r.status, 201);
  assert.match(r.body.item.id, /^cf_[a-f0-9]{12}$/);
  assert.equal(r.body.item.mine, true);
  assert.equal(r.body.item.school, 'must-mhts');

  const list = await api('', { device: devB });
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].mine, false);
  assert.equal(list.body.items[0].tag, 'love');

  const bySchool = await api('?school=must');
  assert.equal(bySchool.body.items.length, 1);
  const other = await api('?school=num');
  assert.equal(other.body.items.length, 0);
});

test('18+ баталгаа, төхөөрөмж, урт шалгана', async () => {
  assert.equal((await api('', { method: 'POST', device: devA, body: { text: 'Энэ бол урт текст шүү' } })).body.error, 'adult_confirmation_required');
  assert.equal((await post('Энэ бол урт текст шүү', null)).body.error, 'no_device');
  assert.equal((await post('   ')).body.error, 'empty');
  assert.equal((await post('богино')).status, 201);
  assert.equal((await post('a'.repeat(1001), devB)).body.error, 'too_long');
});

test('утас, линк, хаяг бичихийг хориглоно', async () => {
  for (const text of [
    'Намайг хайвал 99112233 руу залгаарай',
    'Миний дугаар +976 8811-2233 шүү',
    'instagram: noone.mn гэж хайгаарай',
    'Миний хаяг @sainaa_99 шүү найзуудаа',
    'Энэ сайтыг үзээрэй www.example.com',
  ]) {
    const r = await post(text);
    assert.equal(r.body.error, 'contact_info', text);
  }
  assert.equal(containsContactInfo('2019-2023 онд сургуульд байхдаа'), false);
  assert.equal(containsContactInfo('Би 20 настай, 3-р курс'), false);
});

test('хараалыг далдлаж, давхардлыг хориглоно', async () => {
  const r = await post('Тэр fuck гэж хэлэхэд бүгд инээсэн');
  assert.equal(r.status, 201);
  assert.match(r.body.item.text, /f\*\*\*/);
  const dup = await post('тэр FUCK гэж хэлэхэд бүгд инээсэн!!', devB);
  assert.equal(dup.body.error, 'duplicate');
});

test('like нэг төхөөрөмжөөс нэг л удаа, буцааж болно', async () => {
  const { body } = await post('Өнөөдөр шалгалтандаа унасан ч гэсэн баяртай байна');
  const id = body.item.id;
  await api(`/${id}/like`, { method: 'POST', device: devB, body: { like: true } });
  const again = await api(`/${id}/like`, { method: 'POST', device: devB, body: { like: true } });
  assert.deepEqual(again.body, { ok: true, likes: 1, liked: true });
  await api(`/${id}/like`, { method: 'POST', device: devC, body: { like: true } });
  const unlike = await api(`/${id}/like`, { method: 'POST', device: devB, body: { like: false } });
  assert.equal(unlike.body.likes, 1);

  const top = await api('?sort=top', { device: devC });
  assert.equal(top.body.items[0].liked, true);
});

test('3 өөр хүн мэдээлбэл нуугдана, зохиогч мэдээлэх боломжгүй', async () => {
  const { body } = await post('Ажлын газрынхаа даргыг үзэн яддаг');
  const id = body.item.id;
  assert.equal((await api(`/${id}/report`, { method: 'POST', device: devA, body: { reason: 'spam' } })).body.error, 'own_post');
  await api(`/${id}/report`, { method: 'POST', device: devB, body: { reason: 'spam' } });
  await api(`/${id}/report`, { method: 'POST', device: devB, body: { reason: 'spam' } }); // давхар тоологдохгүй
  await api(`/${id}/report`, { method: 'POST', device: devC, body: { reason: 'spam' } });
  assert.equal((await api('')).body.items.length, 1);
  const dev = `d_${'e'.repeat(32)}`;
  const last = await api(`/${id}/report`, { method: 'POST', device: dev, body: { reason: 'harassment' } });
  assert.equal(last.body.hidden, true);
  assert.equal((await api('')).body.items.length, 0);
  assert.equal((await api(`/${id}`)).status, 404);
});

test('хувийн мэдээлэл гэсэн мэдээлэл хурдан нуугдана', async () => {
  const { body } = await post('Нэг хүний тухай бичиж байна ээ');
  const id = body.item.id;
  await api(`/${id}/report`, { method: 'POST', device: devB, body: { reason: 'personal_info' } });
  const r = await api(`/${id}/report`, { method: 'POST', device: devC, body: { reason: 'personal_info' } });
  assert.equal(r.body.hidden, true);
});

test('зохиогч л устгана', async () => {
  const { body } = await post('Устгах гэж байгаа confession');
  const id = body.item.id;
  assert.equal((await api(`/${id}`, { method: 'DELETE', device: devB })).status, 403);
  assert.equal((await api(`/${id}`, { method: 'DELETE', device: devA })).status, 200);
  assert.equal((await api('')).body.items.length, 0);
});

test('бичих хурдны хязгаар', async () => {
  for (let i = 0; i < 3; i += 1) assert.equal((await post(`Хурдны хязгаарын тест дугаар ${'ийм'.repeat(i + 1)}`)).status, 201);
  const r = await post('Хурдны хязгаарын тест дөрөв дэх нь');
  assert.equal(r.status, 429);
  assert.ok(r.body.retryAfterMs > 0);
});

test('шууд нийтлэгдэж, админ дараа нь устгана', async () => {
  const { body } = await post('Шууд нийтлэгдэх ёстой бичлэг');
  assert.equal((await api('', { device: devB })).body.items.length, 1);
  const del = await adminApi(`/${body.item.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal((await api('', { device: devB })).body.items.length, 0);
});

test('админ нууж, устгана', async () => {
  const { body } = await post('Админ шалгах confession бичлээ');
  const id = body.item.id;
  const noAuth = await fetch(`${url}/api/admin/confessions`);
  assert.equal(noAuth.status, 404);
  const auth = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };
  const list = await (await fetch(`${url}/api/admin/confessions`, { headers: auth })).json();
  assert.equal(list.count, 1);
  await fetch(`${url}/api/admin/confessions/${id}/hide`, { method: 'POST', headers: auth, body: '{}' });
  assert.equal((await api('')).body.items.length, 0);
});

test('мэдээлэгдсэнийг зөвшөөрвөл мэдээлэл цэвэрлэгдэнэ', async () => {
  const { body } = await post('Мэдээлэгдэх бичлэг энд байна');
  const id = body.item.id;
  await api(`/${id}/report`, { method: 'POST', device: devB, body: { reason: 'spam' } });
  const reported = await adminApi('?filter=reported');
  assert.equal(reported.body.items[0].reports, 1);
  const ok = await adminApi(`/${id}/approve`, { method: 'POST' });
  assert.equal(ok.body.item.reports, 0);
  assert.equal((await adminApi('?filter=reported')).body.count, 0);
});

test('зохиогчийг хориглоход бүх бичлэг нь нуугдаж, дахин бичиж чадахгүй', async () => {
  const a = (await post('Муу бичлэг нэг энд байна')).body.item;
  await post('Муу бичлэг хоёр энд байна');
  const r = await adminApi(`/${a.id}/ban`, { method: 'POST', body: { days: 7, ip: false } });
  assert.equal(r.body.hiddenCount, 2);
  assert.equal((await api('')).body.items.length, 0);
  const again = await post('Дахиад бичих гэж оролдлоо');
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'banned');
  assert.equal((await post('Өөр хүн бичиж байна шүү', devB)).status, 201);

  const list = await adminApi('/bans');
  assert.equal(list.body.bans.length, 1);
  await adminApi(`/bans/${encodeURIComponent(list.body.bans[0].key)}`, { method: 'DELETE' });
  assert.equal((await post('Хоригоос гарсны дараа бичлээ')).status, 201);
});

test('админ: буруу токен', async () => {
  assert.equal((await adminApi('', { token: 'wrong' })).status, 404);
});

const login = (password) =>
  fetch(`${url}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

test('админ: 5 оронтой кодоор нэвтэрч, session токеноор ажиллана', async () => {
  server.adminAuth._internal.perIp.clear();
  server.adminAuth._internal.reset();
  const ok = await login(' 12345 ');
  assert.equal(ok.status, 200);
  assert.match(ok.body.token, /^as_[a-f0-9]{48}$/);
  const list = await adminApi('', { token: ok.body.token });
  assert.equal(list.status, 200);

  assert.equal((await login('11111')).status, 401);
  for (let i = 0; i < 4; i += 1) await login('00000');
  // 5 буруу оролдлогын дараа зөв код ч 15 минут ажиллахгүй
  assert.equal((await login('12345')).status, 429);
  server.adminAuth._internal.perIp.clear();
});

test('хадгалсан өгөгдлөө дахин ачаална', async () => {
  const { createKv } = await import('../src/kv.js');
  const { createConfessions } = await import('../src/confessions.js');
  const kv = createKv();
  const cfg = { ...server.config, confessions: { ...server.config.confessions, saveDelayMs: 10 } };
  const a = createConfessions({ config: cfg, kv });
  await a.ready;
  a._internal.items.set('cf_aaaaaaaaaaaa', {
    id: 'cf_aaaaaaaaaaaa', text: 'хадгалах', tag: 'secret', school: null, ts: Date.now(),
    author: 'x', authorIp: 'y', likers: new Set(['l1', 'l2']), reporters: new Set(), hidden: false,
  });
  await a.close().catch(() => {});
  // close() нь dirty биш бол юу ч бичихгүй — гараар хадгална
  await kv.set('noone:confessions:v1', { v: 1, items: [{ ...a._internal.items.get('cf_aaaaaaaaaaaa'), likers: ['l1', 'l2'], reporters: [] }] });
  const b = createConfessions({ config: cfg, kv });
  await b.ready;
  assert.equal(b._internal.items.get('cf_aaaaaaaaaaaa').likers.size, 2);
  await b.close();
});


// ---------- Зураг ба push ----------
const fakeJpeg = (w = 640, h = 480, pad = 120) => {
  const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
  const bytes = [
    0xff, 0xd8,
    0xff, 0xe0, ...u16(16), 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, ...u16(17), 8, ...u16(h), ...u16(w), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1,
    ...Array.from({ length: pad }, (_, i) => (i * 7) % 251),
    0xff, 0xd9,
  ];
  return Buffer.from(bytes).toString('base64');
};

test('зураг ганцаараа ч нийтлэгдэж, зураг нь гарна', async () => {
  const r = await api('', { method: 'POST', device: devA, body: { adultConfirmed: true, image: { data: fakeJpeg() } } });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.item.image, { w: 640, h: 480 });
  assert.equal(r.body.item.text, '');
  const img = await fetch(`${url}/api/confessions/${r.body.item.id}/image`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  const buf = Buffer.from(await img.arrayBuffer());
  assert.equal(buf.toString('base64'), fakeJpeg());
  const list = await api('');
  assert.deepEqual(list.body.items[0].image, { w: 640, h: 480 });
});

test('зураг: JPEG биш, хэт том, хэт өргөн бол татгалзана', async () => {
  const bad = async (data) => (await api('', { method: 'POST', device: devA, body: { adultConfirmed: true, image: { data } } })).body.error;
  assert.equal(await bad(Buffer.from('<svg onload=alert(1)>'.repeat(10)).toString('base64')), 'bad_image');
  assert.equal(await bad(fakeJpeg(5000, 100)), 'bad_image');
  assert.equal(await bad(fakeJpeg(100, 100, 352 * 1024)), 'image_too_large');
  assert.equal(await bad(42), 'bad_image');
});

test('нуугдсан бичлэгийн зураг нээгдэхгүй, устгахад зураг хамт устна', async () => {
  const r = await api('', { method: 'POST', device: devA, body: { adultConfirmed: true, text: 'Зурагтай нууц', image: { data: fakeJpeg() } } });
  const id = r.body.item.id;
  await adminApi(`/${id}/hide`, { method: 'POST', body: { hidden: true } });
  assert.equal((await fetch(`${url}/api/confessions/${id}/image`)).status, 404);
  const adminImg = await fetch(`${url}/api/admin/confessions/${id}/image`, { headers: { Authorization: 'Bearer secret' } });
  assert.equal(adminImg.status, 200);
  await adminApi(`/${id}/hide`, { method: 'POST', body: { hidden: false } });
  assert.equal((await api(`/${id}`, { method: 'DELETE', device: devA })).status, 200);
  assert.equal((await fetch(`${url}/api/confessions/${id}/image`)).status, 404);
  assert.equal(await server.confessions._internal.items.has(id), false);
});

test('зурагтай бичлэг 2 мэдээлэлээр нуугдана', async () => {
  const r = await api('', { method: 'POST', device: devA, body: { adultConfirmed: true, image: { data: fakeJpeg() } } });
  const id = r.body.item.id;
  assert.equal((await api(`/${id}/report`, { method: 'POST', device: devB, body: { reason: 'spam' } })).body.hidden, false);
  assert.equal((await api(`/${id}/report`, { method: 'POST', device: devC, body: { reason: 'spam' } })).body.hidden, true);
});

const sub = (n) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/test-${n}`,
  keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
});

test('шинэ бичлэг бусад захиалагчид push-ээр очно (бичсэн хүнд үгүй)', async () => {
  const sent = [];
  const origSend = server.push.send;
  server.push.send = async (subscription, payload) => {
    sent.push({ endpoint: subscription.endpoint, payload });
    return 'sent';
  };
  try {
    const { subs } = server.confessions._internal;
    subs.clear();
    assert.equal((await api('/subscribe', { method: 'POST', device: devA, body: { subscription: sub('a') } })).status, 200);
    assert.equal((await api('/subscribe', { method: 'POST', device: devB, body: { subscription: sub('b') } })).status, 200);
    assert.equal((await api('/subscribe', { method: 'POST', device: devC, body: { subscription: { endpoint: 'https://evil.example/x', keys: {} } } })).body.error, 'invalid_subscription');

    const r = await post('Шинэ нууц бичлээ, бүгдэд мэдэгдээрэй');
    assert.equal(r.status, 201);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].endpoint, sub('b').endpoint);
    assert.equal(sent[0].payload.tag, 'noone-wall');
    assert.equal(sent[0].payload.url, `/hana/${r.body.item.id}`);
    assert.match(sent[0].payload.body, /Шинэ нууц бичлээ/);

    // cooldown дотор дахин мэдэгдэхгүй
    await post('Хоёр дахь нууц бичлэг энд байна');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(sent.length, 1);

    // зураг ганцаараа бол "Шинэ зураг"
    for (const s of subs.values()) s.lastNotified = 0;
    await api('', { method: 'POST', device: devC, body: { adultConfirmed: true, image: { data: fakeJpeg() } } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const last = sent.at(-1);
    assert.equal(last.payload.body, '📷 Шинэ зураг');

    // unsubscribe
    await api('/subscribe', { method: 'DELETE', device: devB });
    assert.equal(subs.size, 1);
  } finally {
    server.push.send = origSend;
    server.confessions._internal.subs.clear();
  }
});

test('push: хүчингүй бүртгэл (gone) устана', async () => {
  const origSend = server.push.send;
  server.push.send = async () => 'gone';
  try {
    const { subs } = server.confessions._internal;
    subs.clear();
    await api('/subscribe', { method: 'POST', device: devB, body: { subscription: sub('b') } });
    await post('Бичлэг гарахад хуучин бүртгэл устах ёстой');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(subs.size, 0);
  } finally {
    server.push.send = origSend;
  }
});
