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
  server = createApp({ serveClient: false, clientOrigins: ['*'], adminToken: 'secret' });
  await server.confessions.ready;
  const addr = await server.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  const { items, recentHashes, limits, bans, settings } = server.confessions._internal;
  items.clear();
  recentHashes.clear();
  bans.clear();
  settings.moderation = 'auto';
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
  assert.equal((await post('богино')).body.error, 'too_short');
  assert.equal((await post('a'.repeat(501))).body.error, 'too_long');
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

const adminApi = async (path, { method = 'GET', body, token = 'secret' } = {}) => {
  const res = await fetch(`${url}/api/admin/confessions${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test('manual горим: зөвшөөрөхөөс өмнө зөвхөн зохиогчид харагдана', async () => {
  await adminApi('/settings', { method: 'POST', body: { moderation: 'manual' } });
  const { body } = await post('Шалгагдах ёстой нууц бичлэг');
  assert.equal(body.item.pending, true);
  assert.equal((await api('', { device: devB })).body.items.length, 0);
  assert.equal((await api('', { device: devA })).body.items[0].pending, true);
  assert.equal((await api(`/${body.item.id}`, { device: devB })).status, 404);

  const queue = await adminApi('?filter=pending');
  assert.equal(queue.body.stats.pending, 1);
  await adminApi(`/${body.item.id}/approve`, { method: 'POST' });
  const pub = await api('', { device: devB });
  assert.equal(pub.body.items.length, 1);
  assert.equal(pub.body.items[0].pending, false);
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
