# noone — нэргүй чат

Нэрээ нууцалж, эсрэг хүйсийн санамсаргүй хүнтэй **бодит цагт текстээр** чатлах responsive веб сайт.
Бүртгэл шаардахгүй, мессежийг серверт хадгалдаггүй.

- **Frontend:** React + Vite → **Vercel**
- **Backend:** Node.js + Express + Socket.IO → **Render**

```
noone/
├── client/          React + Vite (Vercel)
│   ├── public/sw.js Service worker (мэдэгдэл, Web Push)
│   └── src/         Дэлгэцүүд, socket логик
├── server/          Express + Socket.IO (Render)
│   ├── src/chat.js  Matchmaking, чат, reply, typing, skip, block/report, rate limit
│   └── test/        Socket e2e тестүүд (17)
├── render.yaml      Render Blueprint
└── client/vercel.json  Vercel тохиргоо (Root Directory = client)
```

## Боломжууд

| Хэсэг | Юу хийдэг |
|---|---|
| Нүүр | «Нууц хэн нэгэнтэй». Эрэгтэй / Эмэгтэй (хоёр л сонголт), сонирхол (заавал биш): Хөгжим, CS GO 2, Спорт, Технологи, Бусад. 18+ ба дүрэм зөвшөөрөх. Нэр сонгохгүй — нөгөө хүнд «Нууц нэгэн» гэж харагдана |
| Matchmaking | Зөвхөн эсрэг хүйстэй холбоно. Ижил сонирхолтой хүнийг түрүүлж (`INTEREST_WAIT_MS`, анхдагч 6 сек) хайгаад, олдохгүй бол хэнтэй ч холбоно |
| Чат | Мессеж + цаг, reply (↩ товч, desktop дээр мессежийг давхар дарах, гар утсанд баруун тийш шудрах; preview, цуцлах, дарахад эх мессеж рүү гүйлгэх), "Бичиж байна…", ижил сонирхол, яриа эхлүүлэх асуулт |
| Дараагийн хүн | Чатыг дуусгаж шууд шинэ хүн хайна. Нөгөө хүнд "чатыг орхилоо" гэж харагдана |
| Үнэлгээ | Чат дууссаны дараа сайн/муу (заавал биш) |
| Аюулгүй байдал | Блоклох (дахин холбохгүй), Мэдээлэх (шалтгаан сонгуулна, бичвэр хадгалахгүй), спамын хязгаар (10-аас олон мессеж хурдан бичвэл «Түр хүлээнэ үү» 3 сек), давтагдсан мессеж, олон мэдээлэл авсан IP-г түр хязгаарлах |
| Өнгө | Хэрэглэгч бүр Тохиргоо (🎨) → гол өнгө (7) болон дэвсгэр (4) сонгоно. Зөвхөн тухайн төхөөрөмжид хадгалагдана |
| Холболт | "Холбогдож байна…", тасрахад баннер + "Дахин холбогдох" товч. 20 сек дотор буцвал чат үргэлжилнэ, хуудас refresh хийсэн ч сэргэнэ |
| Мэдэгдэл | Дуу, уншаагүй тоо (tab гарчиг + "N шинэ мессеж" товч), өөр tab дээр байхад browser notification ("Шинэ мессеж ирлээ" — агуулгагүй), дарахад чат руу буцна |
| Web Push | Service worker + VAPID тохиргоо бэлэн. Түлхүүргүй бол Тохиргоо цонхонд ажиллахгүйг тодорхой бичнэ |

## Нууцлал

- Мессеж зөвхөн Socket.IO-оор нөгөө хүн рүү **дамжина**, серверт бичигдэхгүй. Чат дуусахад өрөөний мэдээлэл устна.
- Спамын шалгалтад зөвхөн мессежийн богино hash-ийг 30 секунд санана.
- Мэдээлэл (report): `{ id, at, reason, reporter hash, reported hash, chatDurationSec }` — нэр, IP, бичвэр байхгүй.
- IP хаягийг давс нэмж hash хийн зөвхөн давтамжийн хязгаарт ашиглана.
- Мэдэгдэлд мессежийн агуулга хэзээ ч гарахгүй.

## Deploy хийх (≈5 минут)

### 1. Backend → Render

1. <https://dashboard.render.com> → **New +** → **Blueprint**
2. `saylosmn/noone` repo-г сонгоод **Apply** дарна (`render.yaml`-аас `noone-server` үүснэ).
3. Deploy дуусахад хаяг нь `https://noone-server.onrender.com` болно. `…/api/health` нээхэд `{"ok":true}` гарвал болсон.

> Хаяг өөр гарвал (жишээ нь `noone-server-x1y2.onrender.com`) дараагийн алхамд Vercel-ийн `VITE_SERVER_URL`-д тэр хаягийг тавина.

### 2. Frontend → Vercel

1. <https://vercel.com/new> → `saylosmn/noone` repo-г **Import** → `client` дээр **Import single project**
2. Root Directory = `client`, Preset = Vite (`client/vercel.json` бусдыг тохируулсан). **Deploy** дарна.
3. Render-ийн хаяг `noone-server.onrender.com`-оос өөр бол: Vercel → Project → Settings → Environment Variables → `VITE_SERVER_URL=https://<таны-render-хаяг>` нэмээд **Redeploy**.

### 3. CORS

Render-ийн `ALLOW_VERCEL_PREVIEWS=true` тул бүх `*.vercel.app` хаяг автоматаар зөвшөөрөгдөнө.
Өөрийн домэйн (жишээ нь `noone.mn`) холбовол Render → Environment → `CLIENT_ORIGIN`-д `https://noone.mn` нэмнэ.

### Анхаарах

- Render-ийн **үнэгүй** багц 15 минут идэвхгүй бол унтдаг. Дараагийн анхны хэрэглэгч ~30–60 сек хүлээнэ (сайт "Сервер сэрж байна…" гэж харуулна). Байнга сэрүүн байлгах бол Starter багц эсвэл uptime ping ашиглана.
- **Vercel дээр backend ажиллахгүй**: Vercel serverless функц байнгын WebSocket холболт, санах ойн дараалал барьж чаддаггүй тул Socket.IO серверийг Render дээр байрлуулсан.

## Локалд ажиллуулах

Node.js 20+ хэрэгтэй.

```bash
npm install            # concurrently
npm run install:all    # server + client хамаарлууд
cp server/.env.example server/.env
npm run dev            # backend :4000, frontend :5173
```

<http://localhost:5173>-г **хоёр өөр хөтөч** (эсвэл энгийн + incognito цонх) дээр нээгээд нэгийг нь Эрэгтэй, нөгөөг Эмэгтэй болгож туршина. Нэг хөтчийн хоёр tab ч ажиллана (tab бүр тусдаа сесстэй).

Тест:

```bash
npm test               # 17 socket e2e тест
```

## ⚠️ Санах ойн дараалал (MVP)

Matchmaking дараалал, идэвхтэй өрөө, блок жагсаалт, мэдээллийн бүртгэл зэрэг нь **серверийн санах ойд** хадгалагдана:

- Сервер дахин асах (deploy, Render унтаад сэрэх, гацах) үед **дараалалд байсан хүмүүс болон идэвхтэй чатууд арилна**. Хэрэглэгчийн дэлгэц дээр "Холболт тасарсан тул чат дууслаа" гэж гарч, шинээр хайж болно.
- Блок жагсаалт tab-ын түр ID-тэй холбоотой тул tab хаагдахад арилна.
- Мэдээллийг файлд бичих бол `REPORT_LOG_FILE=reports.jsonl` тохируулна (Render-ийн үнэгүй багцад диск түр зуурынх).
- Нэгээс олон серверийн instance ажиллуулах бол Redis adapter + Redis дээрх дараалал руу шилжүүлэх шаардлагатай.

## Орчны хувьсагчид

### server (`server/.env.example`)

| Нэр | Анхдагч | Тайлбар |
|---|---|---|
| `PORT` | `4000` | |
| `CLIENT_ORIGIN` | `http://localhost:5173,…` | Зөвшөөрөх frontend хаягууд |
| `ALLOW_VERCEL_PREVIEWS` | `false` | `true` бол `*.vercel.app` зөвшөөрнө |
| `TRUST_PROXY` | `false` | Render дээр `true` |
| `INTEREST_WAIT_MS` | `6000` | Ижил сонирхолтой хүн хүлээх хугацаа |
| `RECONNECT_GRACE_MS` | `20000` | Тасарсны дараа чатыг хадгалах хугацаа |
| `REMATCH_COOLDOWN_MS` | `15000` | Саяхан ярьсан хүнтэй дахин холбохгүй хугацаа |
| `MAX_MESSAGE_LENGTH` | `1000` | |
| `LIMIT_MESSAGE_BURST` / `LIMIT_MESSAGE_PER_SECOND` | `10` / `3` | 10 мессеж дараалан, дараа нь секундэд 3 |
| `LIMIT_CONNECT_PER_MINUTE` | `30` | IP тутмын холболтын хязгаар |
| `REPORT_LOG_FILE` | хоосон | Мэдээллийг JSONL файлд бичих |
| `REPORT_HASH_SALT` | санамсаргүй | ID/IP hash-ийн давс |
| `REPORT_BAN_THRESHOLD` / `REPORT_BAN_MS` | `3` / `900000` | 1 цагт 3 өөр хүн мэдээлбэл 15 мин хязгаарлана |
| `ADMIN_TOKEN` | хоосон | `GET /api/admin/reports` (`Authorization: Bearer …`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | хоосон | Web Push. `npm run vapid --prefix server` |

### client (`client/.env.example`)

| Нэр | Тайлбар |
|---|---|
| `VITE_SERVER_URL` | Backend хаяг. Локалд хоосон (Vite proxy). Production-д `client/.env.production` |

## Web Push идэвхжүүлэх (заавал биш)

```bash
cd server && npm run vapid
```

Гарсан `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`-г Render → Environment-д нэмээд дахин deploy хийнэ. Дараа нь хэрэглэгч Тохиргоо → "Web Push идэвхжүүлэх"-ийг асаана. Push бүртгэл зөвхөн тухайн сессийн хугацаанд санах ойд байна.

## Socket.IO event-үүд

| Клиент → сервер | Сервер → клиент |
|---|---|
| `queue:join {gender, interests, adultConfirmed}` | `session`, `stats` |
| `queue:leave` | `queue:status {phase}` |
| `chat:message {text, replyTo}` → ack `{id, ts}` | `match:found` |
| `chat:typing {typing}` | `chat:message {id, text, ts, replyTo}` |
| `chat:next`, `chat:leave` | `chat:typing` |
| `chat:block`, `chat:report {reason}` | `chat:partner_status {online}` |
| `chat:rate {roomId, rating}` | `chat:ended {reason}` |
| `presence:visibility`, `push:subscribe` | `session:replaced` |
