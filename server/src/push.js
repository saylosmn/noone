import webpush from 'web-push';

// Зөвхөн хөтчүүдийн албан ёсны push үйлчилгээ рүү илгээнэ (SSRF-ээс сэргийлэх).
const ALLOWED_PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];

export function isValidSubscription(sub) {
  if (!sub || typeof sub !== 'object') return false;
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 1024) return false;
  let url;
  try {
    url = new URL(sub.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (!ALLOWED_PUSH_HOSTS.some((re) => re.test(url.hostname))) return false;
  const keys = sub.keys;
  return Boolean(
    keys &&
      typeof keys.p256dh === 'string' &&
      typeof keys.auth === 'string' &&
      keys.p256dh.length < 200 &&
      keys.auth.length < 100,
  );
}

export function createPush(config) {
  let { publicKey, privateKey } = config.vapid;
  const { subject } = config.vapid;
  let ephemeral = false;
  // Түлхүүр тохируулаагүй бол сервер асах бүрт шинээр үүсгэнэ.
  // Клиент түлхүүр өөрчлөгдсөнийг илрүүлж автоматаар дахин бүртгүүлдэг.
  if ((!publicKey || !privateKey) && config.vapid.autoGenerate !== false) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    ephemeral = true;
  }
  let enabled = Boolean(publicKey && privateKey);
  let reason = enabled ? '' : 'VAPID_PUBLIC_KEY болон VAPID_PRIVATE_KEY тохируулаагүй';

  if (enabled) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (err) {
      enabled = false;
      reason = `VAPID түлхүүр буруу: ${err.message}`;
      console.warn(`[push] ${reason}`);
    }
  }

  return {
    get enabled() {
      return enabled;
    },
    reason,
    ephemeral,
    publicKey: enabled ? publicKey : '',
    /**
     * Мессежийн агуулгыг хэзээ ч push-д оруулахгүй — зөвхөн ерөнхий текст.
     * @returns {Promise<'sent'|'gone'|'failed'|'disabled'>}
     */
    async send(subscription, payload) {
      if (!enabled || !subscription) return 'disabled';
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 60,
          urgency: 'high',
        });
        return 'sent';
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) return 'gone';
        return 'failed';
      }
    },
  };
}
