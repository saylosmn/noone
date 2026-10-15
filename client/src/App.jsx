import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from './lib/useChat.js';
import { useSettings } from './lib/useSettings.js';
import { session } from './lib/storage.js';
import { applyTheme } from './lib/theme.js';
import {
  getServiceWorker,
  notificationPermission,
  playPing,
  requestNotificationPermission,
  setServiceWorker,
  showChatNotification,
  unlockAudio,
} from './lib/notify.js';
import { fetchPushConfig, getPushSubscription, pushSupported, subscribePush, unsubscribePush } from './lib/push.js';
import { Landing } from './components/Landing.jsx';
import { Searching } from './components/Searching.jsx';
import { Chat } from './components/Chat.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { ConnectionBanner, ReplacedScreen, Toasts } from './components/Feedback.jsx';

const PROFILE_KEY = 'noone.profile';
const BASE_TITLE = 'noone — нэргүй чат';

export default function App() {
  const [settings, updateSettings] = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => applyTheme(settings.accent, settings.background), [settings.accent, settings.background]);

  const [profile, setProfile] = useState(() => ({
    gender: null,
    interests: [],
    adultConfirmed: false,
    ...session.get(PROFILE_KEY, {}),
  }));
  const profileRef = useRef(profile);
  profileRef.current = profile;
  useEffect(() => session.set(PROFILE_KEY, profile), [profile]);

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
  const [swStatus, setSwStatus] = useState(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'pending' : 'unsupported',
  );
  const [pushConfig, setPushConfig] = useState(null);
  const [pushState, setPushState] = useState(() => (pushSupported() ? 'off' : 'unsupported'));
  const pushConfigRef = useRef(null);
  pushConfigRef.current = pushConfig;

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

  // Шинэ сесс бүрт (сервер санахгүй тул) push бүртгэлийг дахин илгээнэ
  const chatRef = useRef(null);
  const onSession = useCallback(async () => {
    if (!settingsRef.current.pushOptIn || notificationPermission() !== 'granted') return;
    const cfg = pushConfigRef.current || (await fetchPushConfig());
    if (!cfg.enabled) return;
    const sub = await getPushSubscription(getServiceWorker());
    if (!sub) return;
    const res = await chatRef.current?.sendPushSubscription(sub.toJSON());
    setPushState(res?.ok ? 'on' : 'error');
  }, []);

  const { state, actions } = useChat({ profileRef, onIncoming, onMatch, onToast: pushToast, onSession });
  chatRef.current = actions;

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

  // Service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return;
        setServiceWorker(reg);
        setSwStatus('ready');
      })
      .catch(() => !cancelled && setSwStatus('error'));
    const onError = () => setSwStatus('error');
    window.addEventListener('noone:sw-error', onError);
    if (window.__nooneSwError) setSwStatus('error');
    return () => {
      cancelled = true;
      window.removeEventListener('noone:sw-error', onError);
    };
  }, []);

  useEffect(() => {
    if (state.everConnected && !pushConfig) fetchPushConfig().then(setPushConfig);
  }, [state.everConnected, pushConfig]);

  const enableNotifications = useCallback(async () => {
    unlockAudio();
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      updateSettings({ notifications: true });
      pushToast('Мэдэгдэл идэвхжлээ.', 'success');
    } else if (result === 'denied') {
      pushToast('Мэдэгдлийг хориглосон байна. Хөтчийн тохиргооноос зөвшөөрнө үү.');
    }
    return result;
  }, [updateSettings, pushToast]);

  const testNotification = async () => {
    const ok = await showChatNotification('message');
    pushToast(ok ? 'Туршилтын мэдэгдэл илгээлээ.' : 'Мэдэгдэл харуулж чадсангүй.', ok ? 'success' : 'error');
  };

  const togglePush = async (on) => {
    const reg = getServiceWorker();
    if (!on) {
      setPushState('working');
      await unsubscribePush(reg);
      await actions.removePushSubscription();
      updateSettings({ pushOptIn: false });
      setPushState('off');
      return;
    }
    if (!pushConfig?.enabled || !reg) return;
    if (permission !== 'granted') {
      const p = await enableNotifications();
      if (p !== 'granted') return;
    }
    setPushState('working');
    try {
      const sub = await subscribePush(reg, pushConfig.publicKey);
      const res = await actions.sendPushSubscription(sub.toJSON());
      if (!res.ok) throw new Error(res.error);
      updateSettings({ pushOptIn: true });
      setPushState('on');
      pushToast('Web Push идэвхжлээ.', 'success');
    } catch {
      setPushState('error');
      pushToast('Web Push бүртгэж чадсангүй.');
    }
  };

  const start = () => {
    unlockAudio();
    actions.startSearch(profileRef.current);
  };

  if (state.replaced) return <ReplacedScreen onRestart={actions.restartFresh} />;

  let screen;
  if (state.phase === 'searching') {
    screen = (
      <Searching
        search={state.search}
        stats={state.stats}
        conn={state.conn}
        profile={profile}
        onCancel={actions.cancelSearch}
        pendingRating={state.pendingRating}
        ratings={state.ratings}
        onRate={actions.rate}
        onDismissRating={actions.dismissRating}
        permission={permission}
        onEnableNotifications={enableNotifications}
        onOpenSettings={() => setSettingsOpen(true)}
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
      />
    );
  }

  return (
    <div className="app">
      <ConnectionBanner conn={state.conn} everConnected={state.everConnected} slow={slow} onReconnect={actions.reconnect} />
      {screen}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={updateSettings}
        permission={permission}
        onEnableNotifications={enableNotifications}
        onTestNotification={testNotification}
        swStatus={swStatus}
        pushConfig={pushConfig}
        pushState={pushState}
        onTogglePush={togglePush}
      />
    </div>
  );
}
