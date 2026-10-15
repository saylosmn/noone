import { useCallback, useEffect, useRef, useState } from 'react';
import { MUST_SCHOOLS, SCHOOLS, schoolLabel } from '../lib/constants.js';
import {
  CONFESSION_LIMITS,
  CONFESSION_REPORT_REASONS,
  CONFESSION_RULES,
  CONFESSION_TAGS,
  confessionsApi,
  confessionUrl,
  tagInfo,
  timeAgo,
} from '../lib/confessions.js';
import { renderStoryImage } from '../lib/storyImage.js';
import { formatDuration } from '../lib/format.js';
import { Icon, Logo } from './Icon.jsx';
import { ConfirmDialog, Modal } from './Modal.jsx';

function SchoolSelect({ id, value, onChange, emptyLabel, className = '' }) {
  return (
    <div className={`select-wrap ${className}`}>
      <select id={id} className="select" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{emptyLabel}</option>
        <optgroup label="ШУТИС">
          <option value="must">ШУТИС (бүх салбар)</option>
          {MUST_SCHOOLS.map((sc) => (
            <option key={sc.id} value={sc.id}>
              ШУТИС · {sc.short}
            </option>
          ))}
        </optgroup>
        <optgroup label="Бусад их сургууль">
          {SCHOOLS.filter((sc) => !sc.id.startsWith('must') && sc.id !== 'other').map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.label}
            </option>
          ))}
        </optgroup>
      </select>
      <Icon name="chevronDown" size={18} className="select-icon" />
    </div>
  );
}

// ---------------- Нэг confession ----------------
function ConfessionCard({ item, highlight, onLike, onShare, onReport, onDelete }) {
  const tag = tagInfo(item.tag);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  return (
    <article className={`cf-card ${highlight ? 'is-highlight' : ''}`} id={`cf-${item.id}`}>
      {highlight && <p className="cf-pinned">🔗 Хуваалцсан нууц</p>}
      <div className="cf-meta">
        <span className={`cf-tag tag-${item.tag}`}>
          <span aria-hidden="true">{tag.emoji}</span> {tag.label}
        </span>
        {item.school && <span className="cf-school">{schoolLabel(item.school)}</span>}
        {item.mine && <span className="cf-mine">Таных</span>}
        <span className="cf-time">{timeAgo(item.ts)}</span>
      </div>
      <p className="cf-text">{item.text}</p>
      <div className="cf-actions">
        <button
          type="button"
          className={`cf-like ${item.liked ? 'is-liked' : ''}`}
          aria-pressed={item.liked}
          aria-label={item.liked ? 'Like буцаах' : 'Like дарах'}
          onClick={() => onLike(item)}
        >
          <Icon name="heart" size={19} />
          <span>{item.likes || ''}</span>
        </button>
        <button type="button" className="cf-action" onClick={() => onShare(item)}>
          <Icon name="share" size={18} />
          <span>Хуваалцах</span>
        </button>
        <div className="cf-more" ref={menuRef}>
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Бусад үйлдэл"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name="more" size={18} />
          </button>
          {menu && (
            <div className="cf-menu" role="menu">
              {item.mine ? (
                <button
                  type="button"
                  role="menuitem"
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    onDelete(item);
                  }}
                >
                  <Icon name="trash" size={16} /> Устгах
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onReport(item);
                  }}
                >
                  <Icon name="flag" size={16} /> Мэдээлэх
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------- Бичих цонх ----------------
function ComposeModal({ open, onClose, profile, onProfile, onPosted, onToast }) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState('secret');
  const [school, setSchool] = useState(null);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSchool(profile.school && profile.school !== 'other' ? profile.school : null);
    setAdult(profile.adultConfirmed);
    setError('');
    setBusy(false);
  }, [open, profile.school, profile.adultConfirmed]);

  const length = [...text.trim()].length;
  const tooShort = length < CONFESSION_LIMITS.min;

  const submit = async () => {
    if (busy) return;
    if (!adult) return setError('18 нас хүрсэн гэдгээ баталгаажуулна уу.');
    if (tooShort) return setError(`Хамгийн багадаа ${CONFESSION_LIMITS.min} тэмдэгт бичнэ үү.`);
    setBusy(true);
    setError('');
    try {
      const { item } = await confessionsApi.create({ text, tag, school, adultConfirmed: true });
      if (!profile.adultConfirmed) onProfile({ ...profile, adultConfirmed: true });
      setText('');
      setTag('secret');
      onClose();
      onPosted(item);
    } catch (err) {
      setError(err.message);
      if (err.code === 'network') onToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Нууц зүйлс бич"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Болих
          </button>
          <button type="button" className="btn primary" disabled={busy || !length} onClick={submit}>
            {busy ? 'Нийтэлж байна…' : 'Нэргүй нийтлэх'}
          </button>
        </>
      }
    >
      <div className="compose">
        <div className="compose-box">
          <textarea
            className="compose-text"
            data-autofocus
            rows={6}
            maxLength={CONFESSION_LIMITS.max}
            placeholder="Хэнд ч хэлж чадаагүй зүйлээ энд бич… Хэн бичсэнийг хэн ч мэдэхгүй."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError('');
            }}
          />
          <span className={`compose-count ${length > CONFESSION_LIMITS.max - 40 ? 'is-warn' : ''}`}>
            {length}/{CONFESSION_LIMITS.max}
          </span>
        </div>

        <div className="field">
          <span className="field-label small">Ангилал</span>
          <div className="chips" role="radiogroup" aria-label="Ангилал">
            {CONFESSION_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tag === t.id}
                className={`chip ${tag === t.id ? 'is-active' : ''}`}
                onClick={() => setTag(t.id)}
              >
                <span aria-hidden="true">{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label small" htmlFor="cf-school">
            Сургууль <span className="optional">заавал биш</span>
          </label>
          <SchoolSelect id="cf-school" value={school} onChange={setSchool} emptyLabel="Сургуулиа харуулахгүй" />
        </div>

        <ul className="compose-rules">
          {CONFESSION_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        {!profile.adultConfirmed && (
          <label className="check">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span className="check-box" aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            <span>
              Би <b>18 ба түүнээс дээш</b> настай бөгөөд дүрмийг дагахаа зөвшөөрч байна.
            </span>
          </label>
        )}

        {error && (
          <p className="compose-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Хуваалцах цонх ----------------
function ShareModal({ item, onClose, onToast, justPosted }) {
  const [image, setImage] = useState(null); // { blob, url }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!item) return undefined;
    let url = null;
    let cancelled = false;
    setImage(null);
    setFailed(false);
    renderStoryImage(item)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  if (!item) return null;
  const link = confessionUrl(item.id);
  const file = image ? new File([image.blob], `noone-${item.id}.png`, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const download = () => {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = `noone-${item.id}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    onToast('Зураг татагдлаа. Story-доо оруулаарай 📸', 'success');
  };

  const shareImage = async () => {
    try {
      await navigator.share({ files: [file], text: link });
    } catch (err) {
      if (err?.name !== 'AbortError') download();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onToast('Линк хуулагдлаа.', 'success');
    } catch {
      onToast('Линк хуулж чадсангүй.');
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ url: link, title: 'noone — Нууц хана' });
    } catch (err) {
      if (err?.name !== 'AbortError') copyLink();
    }
  };

  return (
    <Modal open onClose={onClose} title={justPosted ? 'Нийтлэгдлээ 🎉' : 'Хуваалцах'} size="sm">
      <div className="share-sheet">
        {justPosted && <p className="muted-text share-lead">Найзууддаа story-гоор хуваалцаж, хэн нь таахыг хараарай 👀</p>}
        <div className="story-preview">
          {image ? (
            <img src={image.url} alt="Story зураг" />
          ) : (
            <div className="story-loading">{failed ? 'Зураг үүсгэж чадсангүй' : 'Зураг бэлдэж байна…'}</div>
          )}
        </div>
        <div className="share-actions">
          {canShareFile ? (
            <button type="button" className="btn primary block" onClick={shareImage}>
              <Icon name="image" size={18} /> Story-д хуваалцах
            </button>
          ) : (
            <button type="button" className="btn primary block" disabled={!image} onClick={download}>
              <Icon name="download" size={18} /> Story зураг татах
            </button>
          )}
          <div className="share-row">
            <button type="button" className="btn ghost" onClick={copyLink}>
              <Icon name="link" size={18} /> Линк хуулах
            </button>
            {typeof navigator.share === 'function' && (
              <button type="button" className="btn ghost" onClick={shareLink}>
                <Icon name="share" size={18} /> Илгээх
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Мэдээлэх цонх ----------------
function ReportConfessionModal({ item, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReason('');
    setBusy(false);
  }, [item]);
  if (!item) return null;
  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const ok = await onSubmit(item, reason);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Мэдээлэх"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn danger" disabled={!reason || busy} onClick={submit}>
            {busy ? 'Илгээж байна…' : 'Мэдээлэх'}
          </button>
        </>
      }
    >
      <fieldset className="reason-list">
        <legend>Юу нь буруу байна?</legend>
        {CONFESSION_REPORT_REASONS.map((r) => (
          <label key={r.id} className={`reason ${reason === r.id ? 'is-active' : ''}`}>
            <input type="radio" name="cf-report" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span className="radio-dot" aria-hidden="true" />
            {r.label}
          </label>
        ))}
      </fieldset>
      <p className="hint">Хэд хэдэн хүн мэдээлбэл автоматаар нуугдана. Таны мэдээлэл нэргүй.</p>
    </Modal>
  );
}

// ---------------- Хайж байх үеийн туз ----------------
function SearchingBar({ search, onBack, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="wall-searching" role="status">
      <span className="pulse-dot" aria-hidden="true" />
      <span>
        Хүн хайж байна · <b>{formatDuration(now - (search.since || now))}</b>
      </span>
      <span className="wall-searching-actions">
        <button type="button" className="link-btn" onClick={onCancel}>
          Цуцлах
        </button>
        <button type="button" className="btn sm light" onClick={onBack}>
          Буцах
        </button>
      </span>
    </div>
  );
}

// ---------------- Нууц хана ----------------
export function Confessions({ focusId, profile, onProfile, onBack, onNavigate, onToast, searching, search, onCancelSearch }) {
  const [sort, setSort] = useState('new');
  const [tag, setTag] = useState(null);
  const [school, setSchool] = useState(null);
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [share, setShare] = useState(null); // { item, justPosted }
  const [reporting, setReporting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const reqId = useRef(0);
  // Modal-ын onClose тогтвортой байх ёстой (эс тэгвээс focus үсэрнэ)
  const closeCompose = useCallback(() => setComposeOpen(false), []);
  const closeShare = useCallback(() => setShare(null), []);
  const closeReport = useCallback(() => setReporting(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setStatus('loading');
    try {
      const data = await confessionsApi.list({ sort, tag, school });
      if (id !== reqId.current) return;
      setItems(data.items);
      setNext(data.next);
      setStatus('ready');
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err.message);
      setStatus('error');
    }
  }, [sort, tag, school]);

  useEffect(() => {
    load();
  }, [load]);

  // Хуваалцсан линкээр орсон бол тэр confession-ийг дээр нь харуулна
  useEffect(() => {
    if (!focusId) {
      setFocused(null);
      return undefined;
    }
    let cancelled = false;
    confessionsApi
      .get(focusId)
      .then(({ item }) => !cancelled && setFocused(item))
      .catch((err) => {
        if (cancelled) return;
        setFocused(null);
        onToast(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [focusId, onToast]);

  const loadMore = async () => {
    if (next == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await confessionsApi.list({ sort, tag, school, offset: next });
      setItems((list) => {
        const seen = new Set(list.map((i) => i.id));
        return [...list, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setNext(data.next);
    } catch (err) {
      onToast(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const patchItem = (id, patch) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setFocused((f) => (f?.id === id ? { ...f, ...patch } : f));
  };
  const dropItem = (id) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setFocused((f) => (f?.id === id ? null : f));
  };

  const like = async (item) => {
    const liked = !item.liked;
    patchItem(item.id, { liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) });
    try {
      const res = await confessionsApi.like(item.id, liked);
      patchItem(item.id, { liked: res.liked, likes: res.likes });
    } catch (err) {
      patchItem(item.id, { liked: item.liked, likes: item.likes });
      if (err.code === 'not_found') dropItem(item.id);
      onToast(err.message);
    }
  };

  const report = async (item, reason) => {
    try {
      await confessionsApi.report(item.id, reason);
      dropItem(item.id);
      onToast('Мэдээлэл илгээгдлээ. Баярлалаа.', 'success');
      return true;
    } catch (err) {
      onToast(err.message);
      return false;
    }
  };

  const remove = async (item) => {
    try {
      await confessionsApi.remove(item.id);
      dropItem(item.id);
      onToast('Устгагдлаа.', 'success');
    } catch (err) {
      onToast(err.message);
    }
  };

  const onPosted = (item) => {
    if (sort === 'new' && (!tag || tag === item.tag) && (!school || item.school?.startsWith(school))) {
      setItems((list) => [item, ...list]);
    }
    setShare({ item, justPosted: true });
  };

  const cardProps = {
    onLike: like,
    onShare: (item) => setShare({ item, justPosted: false }),
    onReport: setReporting,
    onDelete: setDeleting,
  };

  return (
    <div className="screen wall">
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="icon-btn" aria-label="Нүүр хуудас руу буцах" onClick={onBack}>
            <Icon name="arrowLeft" />
          </button>
          <Logo small />
        </div>
        <button type="button" className="btn sm primary wall-top-compose" onClick={() => setComposeOpen(true)}>
          <Icon name="plus" size={18} /> Бичих
        </button>
      </header>

      {searching && <SearchingBar search={search} onBack={onBack} onCancel={onCancelSearch} />}

      <main className="wall-main">
        <section className="wall-hero">
          <p className="eyebrow">Нэргүй · 18+ · Хэн бичсэн нь үл мэдэгдэнэ</p>
          <h1>
            Нууц <span className="grad-text">хана</span>
          </h1>
          <p className="hero-sub">Хэнд ч хэлж чадаагүй зүйлээ нэргүйгээр бич. Бусдын нууцыг уншиж, ❤️ дар.</p>
          <button type="button" className="compose-cta" onClick={() => setComposeOpen(true)}>
            <span className="compose-cta-fake">Нууц зүйлс бич…</span>
            <span className="btn sm primary" aria-hidden="true">
              <Icon name="plus" size={16} /> Бичих
            </span>
          </button>
        </section>

        {focused && <ConfessionCard item={focused} highlight {...cardProps} />}

        <div className="wall-controls">
          <div className="segmented" role="tablist" aria-label="Эрэмбэ">
            {[
              ['new', 'Шинэ'],
              ['top', '🔥 Шилдэг'],
            ].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={sort === id} className={sort === id ? 'is-active' : ''} onClick={() => setSort(id)}>
                {label}
              </button>
            ))}
          </div>
          <SchoolSelect value={school} onChange={setSchool} emptyLabel="Бүх сургууль" className="wall-school" />
        </div>

        <div className="chips tag-filter" aria-label="Ангиллаар шүүх">
          <button type="button" className={`chip ${!tag ? 'is-active' : ''}`} aria-pressed={!tag} onClick={() => setTag(null)}>
            Бүгд
          </button>
          {CONFESSION_TAGS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tag === t.id}
              className={`chip ${tag === t.id ? 'is-active' : ''}`}
              onClick={() => setTag(tag === t.id ? null : t.id)}
            >
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <section className="wall-list" aria-live="polite" aria-busy={status === 'loading'}>
          {status === 'loading' &&
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="cf-card cf-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ))}
          {status === 'error' && (
            <div className="wall-empty">
              <p>{error}</p>
              <button type="button" className="btn ghost sm" onClick={load}>
                <Icon name="refresh" size={16} /> Дахин оролдох
              </button>
            </div>
          )}
          {status === 'ready' && items.length === 0 && (
            <div className="wall-empty">
              <p className="wall-empty-emoji" aria-hidden="true">
                🤫
              </p>
              <p>
                {sort === 'top' ? 'Энэ 7 хоногт like авсан нууц алга.' : 'Энд одоохондоо хоосон байна.'}
                <br />
                Нууц зүйлс бич!
              </p>
              <button type="button" className="btn primary sm" onClick={() => setComposeOpen(true)}>
                <Icon name="plus" size={16} /> Бичих
              </button>
            </div>
          )}
          {status === 'ready' &&
            items.filter((i) => i.id !== focused?.id).map((item) => <ConfessionCard key={item.id} item={item} {...cardProps} />)}
          {status === 'ready' && next != null && (
            <button type="button" className="btn ghost block" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Ачаалж байна…' : 'Цааш үзэх'}
            </button>
          )}
        </section>

        {!searching && (
          <section className="wall-chat-cta card">
            <div>
              <strong>Нууц хэн нэгэнтэй ярилцмаар байна уу?</strong>
              <span>Эсрэг хүйсийн санамсаргүй хүнтэй нэргүй чатла.</span>
            </div>
            <button type="button" className="btn primary sm" onClick={() => onNavigate('/')}>
              Чат эхлүүлэх
            </button>
          </section>
        )}
      </main>

      <button type="button" className="wall-fab" aria-label="Нууц зүйлс бич" onClick={() => setComposeOpen(true)}>
        <Icon name="plus" size={26} strokeWidth={2.4} />
      </button>

      <ComposeModal
        open={composeOpen}
        onClose={closeCompose}
        profile={profile}
        onProfile={onProfile}
        onPosted={onPosted}
        onToast={onToast}
      />
      <ShareModal item={share?.item} justPosted={share?.justPosted} onClose={closeShare} onToast={onToast} />
      <ReportConfessionModal item={reporting} onClose={closeReport} onSubmit={report} />
      <ConfirmDialog
        open={!!deleting}
        title="Устгах уу?"
        body="Энэ нууц ханнаас бүрмөсөн устна."
        confirmLabel="Устгах"
        onConfirm={() => remove(deleting)}
        onClose={closeDelete}
      />
    </div>
  );
}
