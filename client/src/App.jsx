import { FriendsInbox } from './components/FriendsInbox.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from './lib/useChat.js';
import { useSettings } from './lib/useSettings.js';
import { session } from './lib/storage.js';
import { applyTheme } from './lib/theme.js';
import { useUpdateCheck } from './lib/useUpdateCheck.js';
import { ensurePushSubscription, removePushSubscription } from './lib/push.js';
import { InstallCard } from './components/InstallCard.jsx';
import {
  notificationPermission,
  playPing,
  requestNotificationPermission,
  setServiceWorker,
  showChatNotification,
  unlockAudio,
} from './lib/notify.js';
import { Landing } from './components/Landing.jsx';
import { Searching } from './components/Searching.jsx';
import { Chat } from './components/Chat.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { Confessions } from './components/Confessions.jsx';
import { Admin } from './components/Admin.jsx';
import { ConnectionBanner, ReplacedScreen, Toasts } from './components/Feedback.jsx';

const PROFILE_KEY = 'noone.profile';

// Энгийн замчлал: "/" — чат, "/hana" — нууц хана, "/hana/<id>" — тодорхой confession
function parseRoute(pathname) {
  if (/^\/admin\/?$/.test(pathname)) return { view: 'admin', id: null };
  const m = pathname.match(/^\/hana(?:\/(cf_[a-f0-9]{12}))?\/?$/);
  return m ? { view: 'wall', id: m[1] || null } : { view: 'home', id: null };
}
const BASE_TITLE = 'noone — нэргүй чат';

export default function App() {
  const [settings, updateSettings] = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => applyTheme(settings.accent, settings.background), [settings.accent, settings.background]);

  const [profile, setProfile] = useState(() => ({
    gender: null,
    mode: 'chat',
    interests: [],
    school: null,
    adultConfirmed: false,
    ...session.get(PROFILE_KEY, {}),
  }));
  const profileRef = useRef(profile);
  profileRef.current = profile;
  useEffect(() => session.set(PROFILE_KEY, profile), [profile]);

  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const navigate = useCallback((path, { replace = false } = {}) => {
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    setRoute(parseRoute(path));
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [toasts, setToasts] = useState([]);
  const pushToast = useCallback((text, tone = 'error') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((list) => [...list.filter((t) => t.text !== text).slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);
  const dismissToast = (id) => setToasts((list) => list.filter((t) => t.id !== id));

  const [permission, setPermission] = useState(notificationPermission);
  const [unread, setUnread] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slow, setSlow] = useState(false);

  const isHidden = () => document.visibilityState === 'hidden';

  const onIncoming = useCallback(() => {
    if (settingsRef.current.sound) playPing();
    if (isHidden() || !document.hasFocus()) setUnread((n) => n + 1);
    if (isHidden() && settingsRef.current.notifications) showChatNotification('message');
  }, []);

  const onMatch = useCallback(() => {
    if (settingsRef.current.sound) playPing();
    if (isHidden()) {
      setUnread((n) => n + 1);
      if (settingsRef.current.notifications) showChatNotification('match');
    }
  }, []);

  const syncPushRef = useRef(null);
  const { state, actions } = useChat({ profileRef, onIncoming, onMatch, onToast: pushToast, onSession: () => syncPushRef.current?.() });

  // Web Push: зөвшөөрөл өгсөн бол бүртгэлээ серверт өгнө (сервер дахин асах бүрт шинэчилнэ)
  const syncPush = useCallback(async () => {
    if (!settingsRef.current.notifications || notificationPermission() !== 'granted') return;
    try {
      const sub = await ensurePushSubscription();
      if (sub) await actions.sendPushSubscription(sub);
    } catch {
      /* push дэмжихгүй / амжилтгүй — tab нээлттэй үеийн мэдэгдэл ажилласаар */
    }
  }, [actions]);
  syncPushRef.current = syncPush;
  // Чатлаж / хайж байхад гэнэт refresh хийхгүй
  const updateReady = useUpdateCheck(state.phase === 'chatting' || state.phase === 'searching');

  // Хүн олдмогц нууц ханаас чат руу шилжинэ
  useEffect(() => {
    if (state.phase === 'chatting' && route.view !== 'home') navigate('/', { replace: true });
  }, [state.phase, route.view, navigate]);

  // Мэдэгдэл дарахад нээлттэй цонхыг тухайн нууц руу шилжүүлнэ (зөвхөн /hana замууд)
  useEffect(() => {
    const onNavigate = (e) => {
      const url = e.detail;
      if (typeof url === 'string' && /^\/hana(\/cf_[a-f0-9]{12})?$/.test(url)) {
        window.focus();
        navigate(url);
      }
    };
    window.addEventListener('noone:navigate', onNavigate);
    return () => window.removeEventListener('noone:navigate', onNavigate);
  }, [navigate]);

  // Таб-ын гарчигт уншаагүй тоо
  useEffect(() => {
    document.title = unread ? `(${unread}) Шинэ мессеж · noone` : BASE_TITLE;
  }, [unread]);

  useEffect(() => {
    const reset = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) setUnread(0);
      setPermission(notificationPermission());
    };
    const onOpenChat = () => {
      window.focus();
      setUnread(0);
    };
    window.addEventListener('focus', reset);
    document.addEventListener('visibilitychange', reset);
    window.addEventListener('noone:open-chat', onOpenChat);
    return () => {
      window.removeEventListener('focus', reset);
      document.removeEventListener('visibilitychange', reset);
      window.removeEventListener('noone:open-chat', onOpenChat);
    };
  }, []);

  // Анх холбогдохгүй удвал "сервер сэрж байна" гэж харуулна
  useEffect(() => {
    if (state.everConnected) return undefined;
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [state.everConnected]);

  // Service worker (мэдэгдэл дээр дарахад чат руу буцаахад ашиглана)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let cancelled = false;
    navigator.serviceWorker.ready.then((reg) => !cancelled && setServiceWorker(reg)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const enableNotifications = useCallback(async () => {
    unlockAudio();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      updateSettings({ notifications: true });
      settingsRef.current = { ...settingsRef.current, notifications: true };
      pushToast('Мэдэгдэл идэвхжлээ.', 'success');
      syncPushRef.current?.();
    } else if (result === 'denied') {
      pushToast('Мэдэгдлийг хориглосон байна. Хөтчийн тохиргооноос зөвшөөрнө үү.');
    }
    return result;
  }, [updateSettings, pushToast]);

  const testNotification = async () => {
    const ok = await showChatNotification('message');
    pushToast(ok ? 'Туршилтын мэдэгдэл илгээлээ.' : 'Мэдэгдэл харуулж чадсангүй.', ok ? 'success' : 'error');
  };

  const start = () => {
    unlockAudio();
    actions.startSearch(profileRef.current);
  };

  if (state.replaced) return <ReplacedScreen onRestart={actions.restartFresh} />;

  let screen;
  if (route.view === 'admin') {
    screen = <Admin onExit={() => navigate('/hana')} onToast={pushToast} />;
  } else if (route.view === 'wall' && state.phase !== 'chatting') {
    screen = (
      <Confessions
        focusId={route.id}
        profile={profile}
        onProfile={setProfile}
        onBack={() => navigate('/')}
        onNavigate={navigate}
        onToast={pushToast}
        searching={state.phase === 'searching'}
        search={state.search}
        onCancelSearch={actions.cancelSearch}
      />
    );
  } else if (state.phase === 'searching') {
    screen = (
      <Searching
        search={state.search}
        stats={state.stats}
        conn={state.conn}
        profile={profile}
        onCancel={actions.cancelSearch}
        onBroaden={actions.broadenSearch}
        pendingRating={state.pendingRating}
        ratings={state.ratings}
        onRate={actions.rate}
        onDismissRating={actions.dismissRating}
        permission={permission}
        onEnableNotifications={enableNotifications}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWall={() => navigate('/hana')}
      />
    );
  } else if (state.phase === 'chatting' || state.phase === 'ended') {
    screen = (
      <Chat
        state={state}
        actions={{
          ...actions,
          next: () => {
            unlockAudio();
            actions.next();
          },
        }}
        settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  } else {
    screen = (
      <Landing
        profile={profile}
        onProfile={setProfile}
        stats={state.stats}
        conn={state.conn}
        onStart={start}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWall={() => navigate('/hana')}
        installSlot={<InstallCard permission={permission} onEnableNotifications={enableNotifications} />}
      />
    );
  }

  return (
    <div className="app">
      <ConnectionBanner conn={state.conn} everConnected={state.everConnected} slow={slow} onReconnect={actions.reconnect} />
      {updateReady && (
        <div className="update-banner" role="status">
          <span>✨ Шинэ хувилбар гарлаа. Чат дуусмагц автоматаар шинэчлэгдэнэ.</span>
          <button type="button" className="btn sm light" onClick={() => window.location.reload()}>
            Одоо шинэчлэх
          </button>
        </div>
      )}
      {screen}
      {state.phase !== 'chatting' && route.view !== 'admin' && <FriendsInbox />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={(patch) => {
          updateSettings(patch);
          if ('notifications' in patch) {
            settingsRef.current = { ...settingsRef.current, ...patch };
            if (patch.notifications) syncPushRef.current?.();
            else {
              removePushSubscription();
              actions.removePushSubscription();
            }
          }
        }}
        permission={permission}
        onEnableNotifications={enableNotifications}
        onTestNotification={testNotification}
      />
    </div>
  );
}
