// Browser мэдэгдэл, дуу. Мэдэгдэлд мессежийн агуулгыг ХЭЗЭЭ Ч оруулахгүй.

let swRegistration = null;
let audioCtx = null;

export function setServiceWorker(reg) {
  swRegistration = reg;
}
export const getServiceWorker = () => swRegistration;

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/** Зөвхөн хэрэглэгч товч дарсны дараа дуудна. */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const BODIES = {
  message: 'Шинэ мессеж ирлээ',
  match: 'Хүн олдлоо — чат эхэллээ',
};

export async function showChatNotification(kind = 'message') {
  if (notificationPermission() !== 'granted') return false;
  const options = {
    body: BODIES[kind] || BODIES.message,
    tag: kind === 'match' ? 'noone-match' : 'noone-message',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: '/' },
  };
  try {
    if (swRegistration?.showNotification) {
      await swRegistration.showNotification('noone', options);
      return true;
    }
    const n = new Notification('noone', options);
    n.onclick = () => {
      window.focus();
      n.close();
      window.dispatchEvent(new CustomEvent('noone:open-chat'));
    };
    return true;
  } catch {
    return false;
  }
}

/** Хэрэглэгчийн анхны товчлолтоор AudioContext-ийг идэвхжүүлнэ (хөтчийн бодлого). */
export function unlockAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* ignore */
  }
}

export function playPing() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  [880, 1318].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.09);
    osc.connect(gain);
    osc.start(t + i * 0.09);
    osc.stop(t + 0.34);
  });
}
