import { NooneAtmosphere } from './NooneAtmosphere.jsx';
import { useState } from 'react';
import { GENDERS, INTERESTS, MUST_SCHOOLS, RULES, SCHOOLS } from '../lib/constants.js';
import { Icon, Logo } from './Icon.jsx';

export function OnlinePill({ conn, online }) {
  return (
    <span className={`online-pill ${conn === 'online' ? '' : 'is-off'}`}>
      <span className="dot" aria-hidden="true" />
      {conn === 'online' ? `${online} онлайн` : 'Холбогдож байна'}
    </span>
  );
}

export function WallLink({ onClick, variant = 'card' }) {
  return (
    <button type="button" className={`wall-link wall-link-${variant}`} onClick={onClick}>
      <span className="wall-link-emoji" aria-hidden="true">🤫</span>
      <span className="wall-link-body">
        <strong>Нууц хана</strong>
        <span>{variant === 'card' ? 'Бусдын нэргүй нууцыг уншиж, нууц зүйлс бич' : 'Хүлээх зуураа бусдын нэргүй нууцыг уншаарай'}</span>
      </span>
      <Icon name="chevronDown" size={18} className="wall-link-arrow" />
    </button>
  );
}

export function Landing({ profile, onProfile, stats, conn, onStart, onOpenSettings, onOpenWall, installSlot }) {
  const [tried, setTried] = useState(false);
  const toggleInterest = (id) =>
    onProfile({
      ...profile,
      interests: profile.interests.includes(id)
        ? profile.interests.filter((i) => i !== id)
        : [...profile.interests, id],
    });

  const missing = [];
  if (!profile.gender) missing.push('хүйсээ сонгоно уу');
  if (!profile.adultConfirmed) missing.push('18+ болон дүрмийг баталгаажуулна уу');
  const online = conn === 'online';
  const blind = profile.mode === 'blind';
  const event = stats.blindDate;
  const dateClosed = blind && !event?.open;

  const handleStart = () => {
    setTried(true);
    if (missing.length || !online || dateClosed) return;
    onStart();
  };

  return (
    <div className="screen landing noone-cinematic">
      <NooneAtmosphere />
      <header className="topbar">
        <Logo />
        <div className="topbar-right">
          <button type="button" className="btn sm ghost topbar-wall" onClick={onOpenWall}>
            🤫 <span>Нууц хана</span>
          </button>
          <OnlinePill conn={conn} online={stats.online} />
          <button type="button" className="icon-btn" aria-label="Өнгө солих" title="Өнгө солих" onClick={onOpenSettings}>
            <Icon name="palette" />
          </button>
          <button type="button" className="icon-btn" aria-label="Тохиргоо" onClick={onOpenSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="landing-main">
        {installSlot}
        <section className="hero">
          <p className="eyebrow">Бүртгэлгүй · Нэргүй · 18+</p>
          <h1>
            Нууц хэн <span className="grad-text">нэгэнтэй</span>
          </h1>
          <p className="hero-sub">
            Эхлээд яриагаар танилц. Дараагийн алхмыг хоёулаа шийд. Нэргүй чат, орой бүрийн blind date.
          </p>

        </section>

        <section className="card setup-card" aria-label="Чат эхлүүлэх тохиргоо">
          <div className="mode-grid" role="group" aria-label="Танилцах горим">
            <button type="button" className={`mode-card ${!blind ? 'is-active' : ''}`} aria-pressed={!blind} onClick={() => onProfile({ ...profile, mode: 'chat' })}>
              <span>💬 Энгийн чат</span><small>Хэзээ ч · Нэргүй яриа</small>
            </button>
            <button type="button" className={`mode-card ${blind ? 'is-active' : ''}`} aria-pressed={blind} onClick={() => onProfile({ ...profile, mode: 'blind' })}>
              <span>💘 Blind date</span><small>20:00–04:00 · УБ цаг</small>
            </button>
          </div>
          {blind && <div className="date-intro">
            <strong>{event?.open ? 'Өнөө оройн болзоо нээлттэй' : 'Орой бүр 20:00-д уулзацгаая'}</strong>
            <p>Ээлжилсэн 4 асуулт → өөрийн тухай 5 факт → green/red flag → чөлөөт чат. Хариулт бүр харилцан харагдана. Үнэгүй.</p>
            <small>04:00-д шинэ хүн хайх хаагдана. Эхэлсэн яриагаа үргэлжлүүлж болно.</small>
          </div>}
          <div className="field">
            <div className="field-label">
              <span className="step">1</span> Би бол
            </div>
            <div className="gender-grid" role="radiogroup" aria-label="Хүйс">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={profile.gender === g.id}
                  className={`gender-btn gender-${g.id} ${profile.gender === g.id ? 'is-active' : ''}`}
                  onClick={() => onProfile({ ...profile, gender: g.id })}
                >
                  <span className="gender-symbol" aria-hidden="true">
                    {g.symbol}
                  </span>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="hint">
              Хүйс нь таны өөрийн мэдүүлэг бөгөөд баталгаажуулдаггүй. Таныг эсрэг хүйсийн хүнтэй холбоно.
            </p>
          </div>

          <details className="setup-details">
            <summary>Тааруулах тохиргоо <span>Сонирхол · Сургууль · Заавал биш</span></summary>
          <div className="field">
            <div className="field-label">
              <span className="step">2</span> Сонирхол <span className="optional">заавал биш</span>
            </div>
            <div className="chips">
              {INTERESTS.map((i) => {
                const active = profile.interests.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={active}
                    className={`chip ${active ? 'is-active' : ''}`}
                    onClick={() => toggleInterest(i.id)}
                  >
                    <span aria-hidden="true">{i.emoji}</span> {i.label}
                  </button>
                );
              })}
            </div>
            <p className="hint">Ижил сонирхолтой хүнийг түрүүлж хайна. Олдохгүй бол бусадтай холбоно.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="school-select">
              <span className="step">3</span> Сургууль <span className="optional">заавал биш</span>
            </label>
            <div className="select-wrap">
              <select
                id="school-select"
                className="select"
                value={profile.school || ''}
                onChange={(e) => onProfile({ ...profile, school: e.target.value || null })}
              >
                <option value="">Хэлэхгүй</option>
                <optgroup label="ШУТИС">
                  <option value="must">ШУТИС (салбараа хэлэхгүй)</option>
                  {MUST_SCHOOLS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      ШУТИС · {sc.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Бусад их сургууль">
                  {SCHOOLS.filter((sc) => !sc.id.startsWith('must')).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <Icon name="chevronDown" size={18} className="select-icon" />
            </div>
            <p className="hint">Нэг сургуулийн (ШУТИС бол нэг салбарын) хүнийг хамгийн түрүүнд хайна. Сургууль тань зөвхөн ижил байвал л нөгөө хүнд харагдана.</p>
          </div>

          </details>
          <details className="setup-details rules-details">
            <summary>Харилцааны дүрэм <span>Хүндэтгэлтэй · Дарамтгүй · 18+</span></summary>
          <div className="rules-box">
            <div className="rules-head">
              <span className="badge-18">18+</span>
              <strong>Харилцааны дүрэм</strong>
            </div>
            <ul>
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          </details>

          <label className={`check ${tried && !profile.adultConfirmed ? 'is-invalid' : ''}`}>
            <input
              type="checkbox"
              checked={profile.adultConfirmed}
              onChange={(e) => onProfile({ ...profile, adultConfirmed: e.target.checked })}
            />
            <span className="check-box" aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            <span>
              Би <b>18 ба түүнээс дээш</b> настай бөгөөд хүндэтгэлтэй харилцах дүрмийг дагахаа зөвшөөрч байна.
            </span>
          </label>

          <button type="button" className="btn primary lg block start-btn" onClick={handleStart} disabled={!online || dateClosed}>
            {!online ? 'Сервертэй холбогдож байна…' : dateClosed ? 'Blind date 20:00-д нээгдэнэ' : blind ? 'Болзооны хүн хайх' : 'Чат эхлүүлэх'}
          </button>
          {tried && missing.length > 0 && (
            <p className="form-error" role="alert">
              Эхлэхийн өмнө {missing.join(', ')}.
            </p>
          )}
        </section>

        <details className="privacy-details">
          <summary>Чатын нууцлал хэрхэн ажилладаг вэ?</summary>
          <p>Хүргэсэн мессежийн түүхийг серверт байнга хадгалахгүй. Холболт түр тасарвал хүргэгдээгүй мессежийг серверийн санах ойд түр барьж, буцаж холбогдоход хүргэнэ. Чат дуусахад серверийн түр өгөгдөл устна; дэлгэц дээрх яриа шинэ чат эхлүүлэх эсвэл нүүр рүү буцахад арилна.</p>
          <p>Репортод шалтгаан, цаг, ярианы хугацаа, таних тэмдгийн hash бүртгэнэ. Ярианы бичвэр, нэр, зураг хавсаргахгүй тул модератор мессежийн агуулгыг уншиж шалгахгүй. Давтамжийн хязгаарлалтад IP-ийн hash ашиглана.</p>
          <p>Blind date-ийн илгээсэн хариулт, факт, green/red flag нөгөө хүнд шууд харагдана. Дараагийн шатанд ч өмнөх хариултуудыг уншиж болно. Сошиал хаяг, найзын холбоо тусдаа хоёр талын зөвшөөрлөөр байнга хадгалагдана. Найзын чатны сүүлийн 200 мессеж серверт байна. Болзооны хариултууд л өрөөний санах ойд түр байна. Хүлээн авсан хүн хуулж эсвэл screenshot хийж болно. Нууц ханын нийтлэл нь чатаас тусдаа, нийтэд харагддаг.</p>
          <p>Болзооны туршилтад хайлт, таарсан хос, харилцан зөвшөөрсөн шат, дахин таарсан сессийн нийт тоог сервер ассан хугацаанд тоолно. Мессежийн агуулгыг хэмжилтэд ашиглахгүй.</p>
        </details>
        <ul className="trust-row">
          <li>
            <Icon name="lock" size={16} /> Бүртгэл, утас, байршил шаардахгүй
          </li>
          <li>
            <Icon name="trash" size={16} /> Серверт байнгын чатын түүхгүй
          </li>
          <li>
            <Icon name="shield" size={16} /> Блоклох, мэдээлэх боломжтой
          </li>
        </ul>
      </main>
    </div>
  );
}
