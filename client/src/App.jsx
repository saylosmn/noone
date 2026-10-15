import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from './lib/useChat.js';
import { useSettings } from './lib/useSettings.js';
import { session } from './lib/storage.js';
import { applyTheme } from './lib/theme.js';
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
    school: null,
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

  const { state, actions } = useChat({ profileRef, onIncoming, onMatch, onToast: pushToast });

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
      />
    </div>
  );
}
