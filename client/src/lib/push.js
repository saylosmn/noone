import { apiUrl } from './socket.js';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

const sameKey = (buf, key) => {
  if (!buf) return false;
  const a = new Uint8Array(buf);
  if (a.length !== key.length) return false;
  return a.every((v, i) => v === key[i]);
};

let cachedConfig = null;
export async function fetchPushConfig() {
  try {
    const res = await fetch(apiUrl('/api/push/config'), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    cachedConfig = await res.json();
  } catch {
    cachedConfig = { enabled: false, publicKey: '' };
  }
  return cachedConfig;
}

/**
 * Push бүртгэлийг баталгаажуулна. Сервер дахин асаад түлхүүр нь солигдсон бол
 * хуучныг цуцалж шинээр бүртгүүлнэ. Амжилттай бол subscription JSON буцаана.
 */
export async function ensurePushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  const cfg = await fetchPushConfig();
  if (!cfg.enabled || !cfg.publicKey) return null;
  const key = urlBase64ToUint8Array(cfg.publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

export async function removePushSubscription() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => {});
}
