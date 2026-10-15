import { apiUrl } from './socket.js';

export async function fetchPushConfig() {
  try {
    const res = await fetch(apiUrl('/api/push/config'), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return { enabled: false, publicKey: '', reason: 'Push тохиргоог серверээс авч чадсангүй' };
  }
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export async function getPushSubscription(reg) {
  try {
    return (await reg?.pushManager?.getSubscription()) || null;
  } catch {
    return null;
  }
}

export async function subscribePush(reg, publicKey) {
  const existing = await getPushSubscription(reg);
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function unsubscribePush(reg) {
  const sub = await getPushSubscription(reg);
  if (sub) await sub.unsubscribe().catch(() => {});
}
