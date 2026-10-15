import { Icon } from './Icon.jsx';

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === 'success' ? 'check' : 'alert'} size={18} />
          <span>{t.text}</span>
          <button type="button" className="icon-btn sm" aria-label="Хаах" onClick={() => onDismiss(t.id)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ConnectionBanner({ conn, everConnected, slow, onReconnect }) {
  if (conn === 'online') return null;
  let text;
  let showButton = true;
  if (!everConnected) {
    text = slow
      ? 'Сервер сэрж байна… Үнэгүй хостинг анх ороход 1 минут хүртэл хугацаа зарцуулж магадгүй.'
      : 'Сервертэй холбогдож байна…';
    showButton = slow;
  } else if (conn === 'connecting') {
    text = 'Дахин холбогдож байна…';
    showButton = false;
  } else {
    text = 'Холболт тасарлаа. Автоматаар дахин оролдож байна…';
  }
  return (
    <div className={`conn-banner ${everConnected ? 'is-error' : ''}`} role="status" aria-live="polite">
      {everConnected && conn === 'offline' ? <Icon name="wifiOff" size={18} /> : <span className="spinner" aria-hidden="true" />}
      <span className="conn-text">{text}</span>
      {showButton && (
        <button type="button" className="btn sm light" onClick={onReconnect}>
          <Icon name="refresh" size={16} /> Дахин холбогдох
        </button>
      )}
    </div>
  );
}

export function RatingCard({ roomId, rating, onRate, onDismiss, title = 'Яриа ямар байв?' }) {
  return (
    <div className="rating-card">
      {rating ? (
        <p className="rating-thanks">
          <Icon name="check" size={18} /> Баярлалаа! Таны үнэлгээ бүртгэгдлээ.
        </p>
      ) : (
        <>
          <span className="rating-title">{title}</span>
          <div className="rating-actions">
            <button type="button" className="rate-btn good" onClick={() => onRate(roomId, 'good')}>
              <Icon name="thumbUp" size={18} /> Сайн
            </button>
            <button type="button" className="rate-btn bad" onClick={() => onRate(roomId, 'bad')}>
              <Icon name="thumbDown" size={18} /> Муу
            </button>
          </div>
        </>
      )}
      {onDismiss && (
        <button type="button" className="icon-btn sm rating-close" aria-label="Үнэлгээг алгасах" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function ReplacedScreen({ onRestart }) {
  return (
    <div className="screen center-screen">
      <div className="state-card">
        <div className="state-icon">
          <Icon name="alert" size={28} />
        </div>
        <h2>Чат өөр цонхонд нээгдлээ</h2>
        <p className="muted-text">
          Энэ сесс өөр tab эсвэл цонх руу шилжсэн тул энд зогссон. Энд шинээр эхлэх бол доорх товчийг дарна уу.
        </p>
        <button type="button" className="btn primary" onClick={onRestart}>
          Энд шинээр эхлэх
        </button>
      </div>
    </div>
  );
}
