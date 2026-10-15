import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/socket.js';
import { session } from '../lib/storage.js';
import { schoolLabel } from '../lib/constants.js';
import { CONFESSION_REPORT_REASONS, tagInfo, timeAgo } from '../lib/confessions.js';
import { Icon, Logo } from './Icon.jsx';
import { ConfirmDialog, Modal } from './Modal.jsx';

const TOKEN_KEY = 'noone.adminToken';

/** Админ нэвтэрсэн бол нууц хана дээрээс шууд устгах боломжтой */
export const adminSessionToken = () => session.get(TOKEN_KEY, '');
const reasonLabel = (id) => CONFESSION_REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

class AdminError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

async function adminLogin(password) {
  let res;
  try {
    res = await fetch(apiUrl('/api/admin/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(70000),
    });
  } catch {
    throw new AdminError(0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const err = new AdminError(res.status, data.error || 'error');
    err.retryAfterMs = data.retryAfterMs;
    throw err;
  }
  return data.token;
}

export async function adminRequest(token, path = '', { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(apiUrl(`/api/admin/confessions${path}`), {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(70000),
    });
  } catch {
    throw new AdminError(0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  // Буруу токенд сервер хоосон 404 буцаадаг
  if (res.status === 404 && !data.error) throw new AdminError(401, 'unauthorized');
  if (!res.ok || data.ok === false) throw new AdminError(res.status, data.error || 'error');
  return data;
}

const errorText = (err) => {
  if (err.message === 'wrong_password') return 'Код буруу байна.';
  if (err.message === 'not_configured') return 'Серверт ADMIN_PASSWORD тохируулаагүй байна (Render → Environment).';
  if (err.status === 401) return 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.';
  if (err.status === 429) {
    const min = Math.max(1, Math.ceil((err.retryAfterMs || 900000) / 60000));
    return `Хэт олон буруу оролдлого. ${min} минутын дараа дахин оролдоно уу.`;
  }
  if (err.status === 0) return 'Сервертэй холбогдож чадсангүй (Render сэрж байж магадгүй).';
  return 'Алдаа гарлаа. Дахин оролдоно уу.';
};

// ---------------- Нэвтрэх ----------------
function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const token = await adminLogin(code.trim());
      const data = await adminRequest(token, '?filter=all');
      onLogin(token, data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="admin-login">
      <form className="card" onSubmit={submit}>
        <span className="admin-lock" aria-hidden="true">
          <Icon name="shield" size={26} />
        </span>
        <h1>Хяналтын хэсэг</h1>
        <p className="hint">Админы нууц кодоо оруулна уу.</p>
        <input
          className="text-input admin-code"
          type="password"
          autoComplete="current-password"
          placeholder="Нууц код"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && <p className="compose-error">{error}</p>}
        <button type="submit" className="btn primary block" disabled={busy || !code.trim()}>
          {busy ? 'Шалгаж байна…' : 'Нэвтрэх'}
        </button>
      </form>
    </main>
  );
}

// ---------------- Нэг бичлэг ----------------
function AdminItem({ item, onAction }) {
  const tag = tagInfo(item.tag);
  let status;
  if (item.hidden) status = <span className="adm-badge bad">{item.hiddenBy === 'reports' ? 'Мэдээллээр нуугдсан' : 'Нуугдсан'}</span>;
  else status = <span className="adm-badge ok">Нийтлэгдсэн</span>;

  return (
    <article className={`adm-item ${item.hidden ? 'is-hidden' : ''}`}>
      <div className="cf-meta">
        {status}
        <span className={`cf-tag tag-${item.tag}`}>
          {tag.emoji} {tag.label}
        </span>
        {item.school && <span className="cf-school">{schoolLabel(item.school)}</span>}
        <span className="cf-time">
          {timeAgo(item.ts)} · ❤ {item.likes}
        </span>
      </div>
      <p className="cf-text">{item.text}</p>
      {item.reports > 0 && (
        <div className="adm-reports">
          <strong>🚩 {item.reports} мэдээлэл:</strong>{' '}
          {Object.entries(item.reasons)
            .map(([r, n]) => `${reasonLabel(r)} (${n})`)
            .join(', ')}
        </div>
      )}
      <p className="adm-author">
        Зохиогч <code>#{item.author || '—'}</code> · {item.authorPosts} бичлэг
        {item.authorBanned && <span className="adm-badge bad">Хориглогдсон</span>}
      </p>
      <div className="adm-actions">
        {(item.hidden || item.reports > 0) && (
          <button type="button" className="btn sm ok-btn" onClick={() => onAction('approve', item)}>
            <Icon name="check" size={16} /> {item.hidden ? 'Сэргээх' : 'Асуудалгүй'}
          </button>
        )}
        {!item.hidden && (
          <button type="button" className="btn sm ghost" onClick={() => onAction('hide', item)}>
            Нуух
          </button>
        )}
        <button type="button" className="btn sm ghost danger-text" onClick={() => onAction('delete', item)}>
          <Icon name="trash" size={16} /> Устгах
        </button>
        {!item.authorBanned && (
          <button type="button" className="btn sm ghost danger-text" onClick={() => onAction('ban', item)}>
            <Icon name="block" size={16} /> Хориглох
          </button>
        )}
      </div>
    </article>
  );
}

// ---------------- Хориглох цонх ----------------
function BanModal({ item, onClose, onConfirm }) {
  const [days, setDays] = useState(7);
  const [ip, setIp] = useState(true);
  useEffect(() => {
    setDays(7);
    setIp(true);
  }, [item]);
  if (!item) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Зохиогчийг хориглох"
      size="sm"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn danger" onClick={() => onConfirm(item, days, ip)}>
            Хориглох
          </button>
        </>
      }
    >
      <p className="muted-text">
        Энэ хүний бүх бичлэг ({item.authorPosts}) нуугдаж, сонгосон хугацаанд шинээр бичиж чадахгүй.
      </p>
      <div className="chips">
        {[
          [1, '1 өдөр'],
          [7, '7 хоног'],
          [30, '30 хоног'],
          [365, '1 жил'],
        ].map(([d, label]) => (
          <button key={d} type="button" className={`chip ${days === d ? 'is-active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>
            {label}
          </button>
        ))}
      </div>
      <label className="check adm-ip-check">
        <input type="checkbox" checked={ip} onChange={(e) => setIp(e.target.checked)} />
        <span className="check-box" aria-hidden="true">
          <Icon name="check" size={14} strokeWidth={3} />
        </span>
        <span>
          IP хаягийг нь бас хориглох. <span className="hint">Сургуулийн wifi-д бусад хүн ч хамаарч болзошгүй.</span>
        </span>
      </label>
    </Modal>
  );
}

const TABS = [
  ['all', '🆕 Бүх бичлэг', null],
  ['reported', '🚩 Мэдээлэгдсэн', 'reported'],
  ['hidden', '🙈 Нуугдсан', null],
  ['bans', '⛔ Хориг', 'bans'],
];

// ---------------- Хяналтын хэсэг ----------------
export function Admin({ onExit, onToast }) {
  const [token, setToken] = useState(() => session.get(TOKEN_KEY, ''));
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [banning, setBanning] = useState(null);
  const reqId = useRef(0);

  const logout = useCallback(() => {
    const t = session.get(TOKEN_KEY, '');
    if (t) fetch(apiUrl('/api/admin/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    session.remove(TOKEN_KEY);
    setToken('');
    setData(null);
  }, []);

  const handleError = useCallback(
    (err) => {
      if (err.status === 401) {
        logout();
        onToast('Токен хүчингүй боллоо. Дахин нэвтэрнэ үү.');
      } else onToast(errorText(err));
    },
    [logout, onToast],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      if (filter === 'bans') {
        const [list, summary] = await Promise.all([adminRequest(token, '/bans'), adminRequest(token, '?filter=reported')]);
        if (id !== reqId.current) return;
        setBans(list.bans);
        setData((d) => ({ ...(d || {}), stats: summary.stats, storage: summary.storage, items: [] }));
      } else {
        const res = await adminRequest(token, `?filter=${filter}&q=${encodeURIComponent(q)}`);
        if (id !== reqId.current) return;
        setData(res);
      }
    } catch (err) {
      if (id === reqId.current) handleError(err);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [token, filter, q, handleError]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // 30 сек тутам шинэчилнэ
  useEffect(() => {
    if (!token) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [token, load]);

  const act = async (path, opts, done) => {
    try {
      const res = await adminRequest(token, path, opts);
      if (res.stats) setData((d) => (d ? { ...d, stats: res.stats } : d));
      if (done) onToast(done, 'success');
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const onAction = (kind, item) => {
    if (kind === 'approve') act(`/${item.id}/approve`, { method: 'POST' }, item.hidden ? 'Сэргээгдлээ.' : 'Мэдээллийг цэвэрлэлээ.');
    if (kind === 'hide') act(`/${item.id}/hide`, { method: 'POST', body: { hidden: true } }, 'Нуугдлаа.');
    if (kind === 'delete') setConfirmDelete(item);
    if (kind === 'ban') setBanning(item);
  };

  const closeDelete = useCallback(() => setConfirmDelete(null), []);
  const closeBan = useCallback(() => setBanning(null), []);


  if (!token) {
    return (
      <div className="screen admin">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn" aria-label="Буцах" onClick={onExit}>
              <Icon name="arrowLeft" />
            </button>
            <Logo small />
          </div>
        </header>
        <Login
          onLogin={(t, first) => {
            session.set(TOKEN_KEY, t);
            setToken(t);
            setData(first);
          }}
        />
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="screen admin">
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="icon-btn" aria-label="Буцах" onClick={onExit}>
            <Icon name="arrowLeft" />
          </button>
          <Logo small />
          <span className="adm-title">Хяналт</span>
        </div>
        <div className="topbar-right">
          <button type="button" className="icon-btn" aria-label="Шинэчлэх" onClick={load} disabled={loading}>
            <Icon name="refresh" className={loading ? 'spin' : ''} />
          </button>
          <button type="button" className="icon-btn" aria-label="Гарах" onClick={logout}>
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="admin-main">
        {data?.storage === 'memory' && (
          <div className="adm-warn" role="alert">
            ⚠️ Нууц хана санах ойд л хадгалагдаж байна — сервер дахин асахад бүгд устна. Render-д{' '}
            <code>UPSTASH_REDIS_REST_URL</code>, <code>UPSTASH_REDIS_REST_TOKEN</code> нэмнэ үү.
          </div>
        )}

        <section className="adm-stats">
          {[
            ['Нийт', stats.total],
            ['Нийтлэгдсэн', stats.public],
            ['Өнөөдөр', stats.today],
            ['Хориг', stats.bans],
            ['Мэдээлэгдсэн', stats.reported, stats.reported > 0 && 'bad'],
            ['Нуугдсан', stats.hidden],
          ].map(([label, value, tone]) => (
            <div key={label} className={`adm-stat ${tone || ''}`}>
              <span>{label}</span>
              <strong>{value ?? '—'}</strong>
            </div>
          ))}
        </section>


        <div className="tag-filter chips adm-tabs" role="tablist">
          {TABS.map(([id, label, key]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={`chip ${filter === id ? 'is-active' : ''}`} onClick={() => setFilter(id)}>
              {label}
              {key && stats[key] > 0 && <span className="adm-count">{stats[key]}</span>}
            </button>
          ))}
        </div>

        {filter !== 'bans' && (
          <input className="text-input adm-search" type="search" placeholder="Бичвэрээс хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}

        {filter === 'bans' ? (
          <section className="adm-list">
            {bans.length === 0 && <p className="wall-empty">Хориглосон хүн алга.</p>}
            {bans.map((b) => (
              <article key={b.key} className="adm-item">
                <div className="cf-meta">
                  <span className="adm-badge bad">{b.kind === 'ip' ? 'IP' : 'Төхөөрөмж'}</span>
                  <span className="cf-time">{new Date(b.until).toLocaleDateString('mn-MN')} хүртэл</span>
                </div>
                {b.text && <p className="cf-text adm-ban-text">“{b.text}”</p>}
                <div className="adm-actions">
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => act(`/bans/${encodeURIComponent(b.key)}`, { method: 'DELETE' }, 'Хориг цуцлагдлаа.')}
                  >
                    Хоригийг цуцлах
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="adm-list" aria-busy={loading}>
            {data?.items?.length === 0 && (
              <p className="wall-empty">{filter === 'reported' ? '🎉 Мэдээлэгдсэн бичлэг алга.' : 'Бичлэг алга.'}</p>
            )}
            {data?.items?.map((item) => <AdminItem key={item.id} item={item} onAction={onAction} />)}
          </section>
        )}
      </main>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Бүрмөсөн устгах уу?"
        body="Энэ бичлэг сэргээх боломжгүйгээр устна."
        confirmLabel="Устгах"
        onConfirm={() => act(`/${confirmDelete.id}`, { method: 'DELETE' }, 'Устгагдлаа.')}
        onClose={closeDelete}
      />
      <BanModal
        item={banning}
        onClose={closeBan}
        onConfirm={(item, days, ip) => {
          setBanning(null);
          act(`/${item.id}/ban`, { method: 'POST', body: { days, ip } }, 'Хориглогдлоо.');
        }}
      />
    </div>
  );
}
