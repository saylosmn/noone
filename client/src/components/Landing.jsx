import { useState } from 'react';
import { GENDERS, INTERESTS, RULES, SCHOOLS } from '../lib/constants.js';
import { Icon, Logo } from './Icon.jsx';

export function OnlinePill({ conn, online }) {
  return (
    <span className={`online-pill ${conn === 'online' ? '' : 'is-off'}`}>
      <span className="dot" aria-hidden="true" />
      {conn === 'online' ? `${online} онлайн` : 'Холбогдож байна'}
    </span>
  );
}

export function Landing({ profile, onProfile, stats, conn, onStart, onOpenSettings }) {
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

  const handleStart = () => {
    setTried(true);
    if (missing.length || !online) return;
    onStart();
  };

  return (
    <div className="screen landing">
      <header className="topbar">
        <Logo />
        <div className="topbar-right">
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
        <section className="hero">
          <p className="eyebrow">Бүртгэлгүй · Нэргүй · 18+</p>
          <h1>
            Нууц хэн <span className="grad-text">нэгэнтэй</span>
          </h1>
          <p className="hero-sub">
            Эсрэг хүйсийн санамсаргүй хүнтэй бодит цагт текстээр чатла. Мессеж хаана ч хадгалагддаггүй.
          </p>
        </section>

        <section className="card setup-card" aria-label="Чат эхлүүлэх тохиргоо">
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
                {SCHOOLS.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={18} className="select-icon" />
            </div>
            <p className="hint">Нэг сургуулийн хүнийг хамгийн түрүүнд хайна. Сургууль тань зөвхөн ижил байвал л нөгөө хүнд харагдана.</p>
          </div>

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

          <button type="button" className="btn primary lg block start-btn" onClick={handleStart} disabled={!online}>
            {online ? 'Чат эхлүүлэх' : 'Сервертэй холбогдож байна…'}
          </button>
          {tried && missing.length > 0 && (
            <p className="form-error" role="alert">
              Эхлэхийн өмнө {missing.join(', ')}.
            </p>
          )}
        </section>

        <ul className="trust-row">
          <li>
            <Icon name="lock" size={16} /> Бүртгэл, утас, байршил шаардахгүй
          </li>
          <li>
            <Icon name="trash" size={16} /> Чат дуусахад мессеж устна
          </li>
          <li>
            <Icon name="shield" size={16} /> Блоклох, мэдээлэх боломжтой
          </li>
        </ul>
      </main>
    </div>
  );
}
