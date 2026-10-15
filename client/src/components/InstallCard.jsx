import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { isIOS, isStandalone, pushSupported } from '../lib/push.js';
import { local } from '../lib/storage.js';

let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event('noone:installable'));
  });
}

/** "Нүүр дэлгэцэнд нэмэх" + апп горимд мэдэгдэл асаах санал */
export function InstallCard({ permission, onEnableNotifications }) {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferredPrompt));
  const [dismissed, setDismissed] = useState(() => local.get('noone.installDismissed', false));
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const standalone = isStandalone();

  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('noone:installable', on);
    return () => window.removeEventListener('noone:installable', on);
  }, []);

  // Апп горимд байгаа бол — мэдэгдлийг асаахыг санал болгоно
  if (standalone) {
    if (permission !== 'default' || !pushSupported()) return null;
    return (
      <div className="install-card">
        <span className="install-icon">
          <Icon name="bell" size={22} />
        </span>
        <div className="install-text">
          <strong>Мэдэгдэл асаах</strong>
          <span>Апп хаалттай байсан ч шинэ мессеж, хүн олдоход мэдэгдэл ирнэ.</span>
        </div>
        <button type="button" className="btn sm primary" onClick={onEnableNotifications}>
          Асаах
        </button>
      </div>
    );
  }

  if (dismissed) return null;
  const ios = isIOS();
  if (!canPrompt && !ios) return null;

  const close = () => {
    setDismissed(true);
    local.set('noone.installDismissed', true);
  };

  return (
    <div className="install-card">
      <span className="install-icon">
        <Icon name="download" size={22} />
      </span>
      <div className="install-text">
        <strong>Апп болгож суулгах</strong>
        <span>Нүүр дэлгэцэндээ нэмбэл апп шиг нээгдэж, мэдэгдэл авна.</span>
        {showIOSSteps && (
          <ol className="ios-steps">
            <li>
              Safari-ийн доод хэсгийн <b>Share</b> <Icon name="share" size={14} /> товч
            </li>
            <li>
              <b>“Add to Home Screen”</b> (Нүүр дэлгэцэнд нэмэх)
            </li>
            <li>Нүүр дэлгэцнээс noone-ийг нээгээд “Мэдэгдэл асаах” дарна</li>
          </ol>
        )}
      </div>
      <div className="install-actions">
        {canPrompt ? (
          <button
            type="button"
            className="btn sm primary"
            onClick={async () => {
              const p = deferredPrompt;
              deferredPrompt = null;
              setCanPrompt(false);
              await p?.prompt();
            }}
          >
            Суулгах
          </button>
        ) : (
          !showIOSSteps && (
            <button type="button" className="btn sm primary" onClick={() => setShowIOSSteps(true)}>
              Яаж?
            </button>
          )
        )}
        <button type="button" className="icon-btn sm" aria-label="Хаах" onClick={close}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
