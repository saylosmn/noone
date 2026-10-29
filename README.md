# noone — нэргүй чат

Нэрээ нууцалж, эсрэг хүйсийн санамсаргүй хүнтэй **бодит цагт текстээр** чатлах responsive веб сайт.
Бүртгэл шаардахгүй, мессежийг серверт хадгалдаггүй.

- **Frontend:** React + Vite → **Vercel** — <https://noone-ten.vercel.app>
- **Backend:** Node.js + Express + Socket.IO → **Render** — <https://noone-server-ggsw.onrender.com/api/health>

```
noone/
├── client/          React + Vite (Vercel)
│   ├── public/sw.js Service worker (мэдэгдэл)
│   └── src/         Дэлгэцүүд, socket логик
├── server/          Express + Socket.IO (Render)
│   ├── src/chat.js  Matchmaking, чат, reply, typing, skip, block/report, rate limit
│   ├── src/confessions.js  Нууц хана (REST API)
│   └── test/        Socket e2e + нууц ханын тестүүд
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
| Дуугаар ярих | Чатын толгой дээрх 📞 товчоор нөгөө хүнийг дуудна (зөвхөн дуу, видео байхгүй). Нөгөө хүнд «Хариулах / Татгалзах» самбар, дуу, чичиргээ гарна; апп нуугдсан бол «Дуудлага ирж байна» push очно. Микрофон хаах, таслах боломжтой. WebRTC шууд холболт: дуу серверээр огт дамжихгүй, сервер зөвхөн signaling (offer/answer/ICE) дамжуулж, хадгалахгүй. Анх дуудахдаа «ярих хугацаанд нөгөө хүн таны IP хаягийг харж болно» гэсэн анхааруулгыг нэг удаа зөвшөөрнө. Үнэгүй STUN ашиглана; зарим сүлжээнд (корпорац, зарим мобайл) шууд холбогдохгүй байж болох бөгөөд тэр үед TURN нэмнэ (доор) |
| Найз болох | Хоёулаа «Найз болох» дарж сошиал хаягаа (Instagram, Telegram, Facebook, Snapchat, Discord, Steam) оруулсан үед л бие биеийнхээ хаягийг харна. Нэг нь л зөвшөөрвөл юу ч ил гарахгүй. Хаяг зөвхөн өрөөний санах ойд, чат дуусахад устна |
| Reaction, стикер | Мессеж дээр ❤️ 😂 👍 😮 😢 🔥 (desktop: 😊+ товч, утас: удаан дарах). noone-ийн өөрийн 12 стикер |
| Сургууль | ШУТИС, МУИС, СЭЗИС… сонговол нэг сургуулийнхныг хамгийн түрүүнд холбоно (3 оноо, сонирхол 1 оноо). Ижил байвал л харагдана |
| Хараалын шүүлтүүр | Монгол (кирилл/латин), орос үгс, англи хараалыг серверт «f***» хэлбэрт оруулна (`server/src/profanity.js`) |
| Нууц хана | `/hana` — нэргүй confession: бичих (бичвэр ≤1000 тэмдэгт эсвэл зураг эсвэл хоёулаа, ангилал, сургууль заавал биш), зураг нэмэх (утсан дээрээс сонгоно, клиент JPEG болгож шахна — EXIF/байршил арилна, ≤350KB), «🔔 Шинэ нууц бичигдэх бүрт мэдэгдэх» (Web Push: бусад бүх захиалагчид бичвэрийн богино preview-тэй мэдэгдэл очно, бичсэн хүнд үгүй, нэг хүнд 3 мин тутамд нэгээс илүүгүй), ❤️, Шинэ / 🔥 Шилдэг (7 хоног), ангилал ба сургуулиар шүүх. Хуваалцах: Instagram story-д зориулсан 1080×1920 зураг + `/hana/<id>` линк. Утас, линк, @хаяг, имэйлийг хориглоно, хараалыг далдална. 3 хүн мэдээлбэл (хувийн мэдээлэл / насанд хүрээгүй / зурагтай бичлэг бол 2) автоматаар нуугдана. Зохиогч өөрийнхөөг устгана. 30 хоногийн дараа устна. Хүн хайж байх зуураа уншиж болно, хүн олдмогц чат руу шилжинэ |
| Хяналт | `/admin` — `ADMIN_PASSWORD` кодоор нэвтэрнэ (жишээ нь 5 оронтой тоо). Бичлэг шууд нийтлэгдэнэ; админ дараа нь устгах, нуух, сэргээх, зохиогчийг (төхөөрөмж + IP) хориглох боломжтой. Нэвтэрсэн бол нууц хана дээрх ⋮ цэснээс шууд «Устгах (админ)». Нэг IP 15 минутад 5 буруу оролдлого, нийт 1 цагт 30 буруу оролдлогод кодоор нэвтрэх 1 цаг түгжигдэнэ |
| Унтахгүй | Render дээр UB цагаар 08:00–02:00 хооронд сервер 10 мин тутам өөр рүүгээ ping хийж сэрүүн байна (`KEEP_ALIVE_HOURS`) |
| Апп шиг (PWA) | Нүүр дэлгэцэнд нэмэх товч (Android: «Суулгах», iPhone: Safari → Share → Add to Home Screen заавар). Апп горимд «Мэдэгдэл асаах» |
| Web Push | Сервер VAPID түлхүүрээ өөрөө үүсгэнэ (тохируулах шаардлагагүй). Апп хаалттай/нуугдсан үед «Шинэ мессеж ирлээ» мэдэгдэл (агуулгагүй). Push-тэй хэрэглэгчийн чат 5 мин хүлээгдэж, хүргэгдээгүй мессеж түр санах ойд байгаад буцаж ороход хүргэгдэнэ, дараа нь устна |
| Холболт | "Холбогдож байна…", тасрахад баннер + "Дахин холбогдох" товч. 20 сек дотор буцвал чат үргэлжилнэ, хуудас refresh хийсэн ч сэргэнэ |
| Мэдэгдэл | Дуу, уншаагүй тоо (tab гарчиг + "N шинэ мессеж" товч), өөр tab дээр байхад browser notification ("Шинэ мессеж ирлээ" — агуулгагүй), дарахад чат руу буцна |

## Нууцлал

- Мессеж зөвхөн Socket.IO-оор нөгөө хүн рүү **дамжина**, серверт бичигдэхгүй. Чат дуусахад өрөөний мэдээлэл устна.
- Спамын шалгалтад зөвхөн мессежийн богино hash-ийг 30 секунд санана.
- Мэдээлэл (report): `{ id, at, reason, reporter hash, reported hash, chatDurationSec }` — нэр, IP, бичвэр байхгүй.
- IP хаягийг давс нэмж hash хийн зөвхөн давтамжийн хязгаарт ашиглана.
- Чатын мэдэгдэлд мессежийн агуулга хэзээ ч гарахгүй. (Нууц ханын нийтийн бичлэгийн мэдэгдэл л preview-тэй.)

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

### Нууц ханын зураг ба мэдэгдэл

- Зураг нь Upstash дээр бичлэг тус бүрээр тусдаа түлхүүрт (`noone:cfimg:<id>`) хадгалагдаж, бичлэг устахад хамт устна. Upstash тохируулаагүй бол санах ойд байгаад сервер дахин асахад арилна.
- Мэдэгдэл найдвартай ажиллахын тулд Render дээр `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`-г тогтмол тавина (`cd server && npm run vapid`). Тавихгүй бол сервер асах бүрт түлхүүр шинэчлэгдэж, хэрэглэгч сайтаа нээхэд л дахин бүртгэгдэнэ.
- Тохируулах хувьсагчид (заавал биш): `CONFESSION_IMAGE_MAX_BYTES`, `CONFESSION_PUSH_COOLDOWN_MS`, `CONFESSION_MAX_SUBSCRIBERS`, `CONFESSION_MAX_LENGTH`.

### Дуудлага: TURN нэмэх (заавал биш)

Анхдагчаар зөвхөн Google-ийн үнэгүй STUN ашиглана. Шууд холбогдож чадахгүй сүлжээнд (симметр NAT) дуудлага «холбогдсонгүй» гэж гарвал TURN сервер тавина: Vercel → Environment Variables → `VITE_ICE_SERVERS` = `[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:<хаяг>:3478","username":"…","credential":"…"}]`. TURN-ээр дамжуулбал нөгөө хүн таны IP-г харахаа болино.

### Анхаарах

- Render-ийн **үнэгүй** багц 15 минут идэвхгүй бол унтдаг. Дараагийн анхны хэрэглэгч ~30–60 сек хүлээнэ (сайт "Сервер сэрж байна…" гэж харуулна). Байнга сэрүүн байлгах бол Starter багц эсвэл uptime ping ашиглана.
- **Vercel дээр backend ажиллахгүй**: Vercel serverless функц байнгын WebSocket холболт, санах ойн дараалал барьж чаддаггүй тул Socket.IO серверийг Render дээр байрлуулсан.

### 4. Нууц ханыг байнга хадгалах (Upstash, үнэгүй)

1. <https://console.upstash.com> → **Create Database** (Redis, бүс: ap-southeast-1 Singapore).
2. Database → **REST API** хэсгээс `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`-ийг хуулна.
3. Render → noone-server → **Environment** → хоёуланг нь нэмээд Save. Логт `Нууц хана: upstash` гарвал болсон.

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
npm test               # socket + нууц ханын тестүүд
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
| `RECONNECT_GRACE_MS` | `900000` | Тасарсны дараа чатыг хадгалах хугацаа (15 мин) |
| `PARTNER_AWAY_NOTICE_MS` | `120000` | Нөгөө хүн хэр удаан алга болоход "гарсан бололтой" гэж мэдэгдэх (2 мин) |
| `REMATCH_COOLDOWN_MS` | `15000` | Саяхан ярьсан хүнтэй дахин холбохгүй хугацаа |
| `MAX_MESSAGE_LENGTH` | `1000` | |
| `LIMIT_MESSAGE_BURST` / `LIMIT_MESSAGE_PER_SECOND` | `10` / `3` | 10 мессеж дараалан, дараа нь секундэд 3 |
| `LIMIT_CONNECT_PER_MINUTE` | `30` | IP тутмын холболтын хязгаар |
| `REPORT_LOG_FILE` | хоосон | Мэдээллийг JSONL файлд бичих |
| `REPORT_HASH_SALT` | санамсаргүй | ID/IP hash-ийн давс |
| `REPORT_BAN_THRESHOLD` / `REPORT_BAN_MS` | `3` / `900000` | 1 цагт 3 өөр хүн мэдээлбэл 15 мин хязгаарлана |
| `ADMIN_TOKEN` | хоосон | `GET /api/admin/reports`, `GET /api/admin/confessions`, `POST …/:id/hide {hidden}`, `DELETE …/:id` (`Authorization: Bearer …`) |
| `ADMIN_PASSWORD` | хоосон | `/admin` хуудсанд нэвтрэх код. Тохируулаагүй бол кодоор нэвтрэх боломжгүй |
| `ADMIN_SESSION_HOURS` | `12` | Нэвтэрсний дараа хэдэн цаг хүчинтэй |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | хоосон | **Нууц ханыг байнга хадгалах.** Тохируулаагүй бол санах ойд л байж, Render дахин асахад арилна |
| `CONFESSION_FILE` | хоосон | Локалд confession-ийг JSON файлд хадгалах |
| `CONFESSION_HIDE_REPORTS` | `3` | Хэдэн хүн мэдээлбэл нуух |
| `CONFESSION_POST_BURST` / `CONFESSION_POST_INTERVAL_SEC` | `3` / `300` | Нэг төхөөрөмж 3-ыг дараалан, дараа нь 5 мин тутам 1 |
| `CONFESSION_RETENTION_DAYS` / `CONFESSION_MAX_ITEMS` | `30` / `2000` | |
| `KEEP_ALIVE` / `KEEP_ALIVE_HOURS` | `true` / `8-2` | Render-ийн `RENDER_EXTERNAL_URL` руу 10 мин тутам ping. UB цагаар 08:00–02:00 (≈560 цаг/сар). `0-0` = үргэлж (≈744 цаг) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | хоосон | Web Push. `npm run vapid --prefix server` |

### client (`client/.env.example`)

| Нэр | Тайлбар |
|---|---|
| `VITE_SERVER_URL` | Backend хаяг. Локалд хоосон (Vite proxy). Production-д `client/.env.production` |

## Socket.IO event-үүд

| Клиент → сервер | Сервер → клиент |
|---|---|
| `queue:join {gender, interests, adultConfirmed}` | `session`, `stats` |
| `queue:leave` | `queue:status {phase}` |
| `chat:message {text, replyTo}` → ack `{id, ts}` | `match:found` |
| `chat:typing {typing}` | `chat:message {id, text \| sticker, ts, replyTo}` |
| `chat:react {messageId, emoji}` | `chat:reaction {messageId, emoji}` |
| `friend:offer {platform, handle}`, `friend:cancel` | `friend:requested`, `friend:reveal {contact}`, `friend:cancelled` |
| `chat:next`, `chat:leave` | `chat:typing` |
| `chat:block`, `chat:report {reason}` | `chat:partner_status {online}` |
| `chat:rate {roomId, rating}` | `chat:ended {reason}` |
| `presence:visibility`, `push:subscribe` | `session:replaced` |

## Нууц ханын REST API

Бүх хүсэлтэд `X-Noone-Device: d_<32 hex>` (клиент localStorage-д үүсгэнэ, серверт зөвхөн hash нь хадгалагдана).

| | |
|---|---|
| `GET /api/confessions?sort=new\|top&tag=&school=&offset=` | `{items, next, total}` |
| `GET /api/confessions/:id` | `{item}` |
| `POST /api/confessions {text, tag, school, adultConfirmed}` | `{item}` |
| `POST /api/confessions/:id/like {like}` | `{likes, liked}` |
| `POST /api/confessions/:id/report {reason}` | `{hidden}` |
| `DELETE /api/confessions/:id` | Зөвхөн зохиогч |

## Blind date (өдөр бүр)

- Улаанбаатарын цагаар **20:00–04:00**, серверийн цагаар нээгдэнэ. 04:00-д хүлээлгийн дараалал хаагдаж, эхэлсэн өрөөнүүд үргэлжилнэ. Таван минутын хязгаар байхгүй.
- Асуулт → текст → дуу → нэр/зураг → сошиал гэсэн таван шаттай. `date:advance {roomId, stage, ready}`-д хоёр тал зөвшөөрсөн үед шилжинэ; ганц талын сонголтыг нөгөө хүнд харуулахгүй. Зөвшөөрлөө шат шилжихээс өмнө буцааж болно.
- Дуудлагыг voice шатнаас, `friend:offer`-ийг connect шатанд сервер зөвшөөрнө. Дуудлага болон нэр/зураг заавал биш.
- `date:profile {roomId, name, photo}`: хоёр тал илгээвэл л профайл харилцан харагдана. JPEG нь клиент дээр дахин кодлогдож EXIF арилна, 480px, data URL ≤120000 тэмдэгт. Профайл зөвхөн өрөөний санах ойд байна. Ил гарахаас өмнө `{roomId, cancel: true}`-ээр цуцална.
- `queue:join`-ийн `mode` нь `chat` (анхдагч) эсвэл `blind`. Хоёр горимын хүмүүс хоорондоо таарахгүй. `queue:broaden` нь сонирхол/сургуулийн хүлээлтийг өргөжүүлэх боловч блок болон горимыг хэвээр үлдээнэ.
- `/admin` дээр болзооны тоонууд харагдана. `GET /api/admin/chat-stats` нь админ эрх шаарддаг. Тоонууд сервер дахин асахад тэглэгдэнэ. Дахин таарсан сесс нь cross-day retention биш; нэг түр сесс хоёр дахь болзоонд таарсныг тоолно.

### Нууцлалын тодруулга

Мессежийг байнгын түүх болгон хадгалахгүй. Холболт тасарсан хүнд хүргэх мессеж санах ойд түр байна. Репорт нь шалтгаан, цаг, hash, хугацаатай бөгөөд мессежийн агуулга агуулахгүй. Чат дуусахад серверийн түр өгөгдөл устна. Клиентийн дэлгэц дээрх түүх шинэ чат эсвэл нүүр рүү буцахад арилна. Энэ тайлбар нь дээрх «мессеж хадгалдаггүй» товчилсон тайлбарыг нарийвчилна.

### Release / validation

Backend (Render) болон frontend (Vercel)-ийг хоёуланг шинэчилнэ; backend-ийг эхэлж deploy хийнэ. Шинэ environment variable шаардлагагүй. Зөвхөн frontend шинэчилбэл blind date нээгдэхгүй.

`npm test --prefix server` — schedule boundary, mode isolation, mutual consent, profile privacy, reconnect, event closing, existing chat/confession regression tests.
`npm run build --prefix client` — production build.
