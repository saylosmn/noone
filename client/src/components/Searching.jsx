import { useEffect, useState } from 'react';
import { interestLabel, schoolLabel } from '../lib/constants.js';
import { formatDuration } from '../lib/format.js';
import { Icon, Logo } from './Icon.jsx';
import { OnlinePill, WallLink } from './Landing.jsx';
import { RatingCard } from './Feedback.jsx';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Searching({
  search,
  stats,
  conn,
  profile,
  onCancel,
  onBroaden,
  pendingRating,
  ratings,
  onRate,
  onDismissRating,
  permission,
  onEnableNotifications,
  onOpenSettings,
  onOpenWall,
}) {
  const now = useNow();
  const since = search.since || now;
  const opposite = profile.gender === 'male' ? 'female' : 'male';
  const mode = profile.mode || 'chat';
  const waitingOpposite = stats.waitingByMode?.[mode]?.[opposite] ?? stats.waiting?.[opposite] ?? 0;
  const oppositeLabel = opposite === 'male' ? 'эрэгтэй' : 'эмэгтэй';
  const hasInterests = profile.interests.length > 0 || Boolean(profile.school);
  const offline = conn !== 'online';

  let title = 'Хүн хайж байна…';
  let sub;
  if (offline) {
    title = 'Холболтыг хүлээж байна…';
    sub = 'Холболт сэргэмэгц автоматаар үргэлжлүүлэн хайна.';
  } else if (hasInterests && search.phase === 'interest') {
    title = 'Тохирох хүн хүлээж байна…';
    sub = [profile.interests.map(interestLabel).join(', '), profile.school ? schoolLabel(profile.school) : ''].filter(Boolean).join(' · ');
  } else if (hasInterests) {
    title = 'Бусад хүмүүсээс хайж байна…';
    sub = 'Сонирхол, сургуулиар хязгаарлахгүй хайж байна. Блоклосон хүнтэй холбохгүй.';
  } else {
    sub = 'Эсрэг хүйсийн санамсаргүй хүнтэй холбоно.';
  }

  return (
    <div className="screen searching">
      <header className="topbar">
        <Logo />
        <div className="topbar-right">
          <OnlinePill conn={conn} online={stats.online} />
          <button type="button" className="icon-btn" aria-label="Тохиргоо" onClick={onOpenSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="searching-main" aria-live="polite">
        <div className={`radar ${offline ? 'is-paused' : ''}`} aria-hidden="true">
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="ring r3" />
          <span className="radar-core">
            <Icon name="search" size={30} />
          </span>
        </div>

        {mode === 'blind' && <p className="eyebrow">💘 Blind date · 20:00–04:00</p>}
        <h1 className="search-title">{title}</h1>
        <p className="search-sub">{sub}</p>
        <p className="search-meta">
          <span className="timer">{formatDuration(now - since)}</span>
          <span className="sep">·</span>
          {waitingOpposite > 0
            ? `${waitingOpposite} ${oppositeLabel} хүлээлгэнд байна`
            : `Одоогоор хүлээж буй ${oppositeLabel} алга — орж ирмэгц холбоно`}
        </p>

        {search.phase === 'interest' && !offline && <button type="button" className="btn primary" onClick={onBroaden}>Шүүлтүүрээ өргөжүүлэх</button>}
        {now - since > 20000 && !offline && <p className="hint">Хүлээлтийн хугацаа хүнээс хамаарна. Хүсвэл цуцлаад дараа дахин орж болно.</p>}
        <button type="button" className="btn ghost" onClick={onCancel}>
          Цуцлах
        </button>

        {onOpenWall && <WallLink onClick={onOpenWall} variant="inline" />}

        {permission === 'default' && (
          <div className="notify-cta">
            <Icon name="bell" size={20} />
            <div>
              <strong>Хүн олдоход мэдэгдэл авах уу?</strong>
              <span>Өөр tab руу шилжсэн ч мэдэгдэнэ. Мессежийн агуулгыг харуулахгүй.</span>
            </div>
            <button type="button" className="btn sm primary" onClick={onEnableNotifications}>
              Мэдэгдэл асаах
            </button>
          </div>
        )}

        {pendingRating && (
          <RatingCard
            roomId={pendingRating.roomId}
            rating={ratings[pendingRating.roomId]}
            onRate={onRate}
            onDismiss={onDismissRating}
            title="Өмнөх яриа ямар байв?"
          />
        )}
      </main>
    </div>
  );
}
