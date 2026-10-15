/**
 * Render-ийн үнэгүй багц 15 минут гаднаас хүсэлт ирэхгүй бол унтдаг.
 * Өөрийн public хаяг руу 10 минут тутам хүсэлт илгээж сэрүүн байлгана —
 * зөвхөн заасан цагийн хооронд (Улаанбаатарын цагаар), үнэгүй цагийн лимитийг хэмнэхийн тулд.
 */
export function inWindow(date, window, tzOffsetHours = 8) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(window || '');
  if (!m) return true; // "always" эсвэл буруу утга бол үргэлж
  const start = Number(m[1]) % 24;
  const end = Number(m[2]) % 24;
  const hour = (date.getUTCHours() + tzOffsetHours + 24) % 24;
  if (start === end) return true;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function startKeepAlive({ url, hours = '8-2', intervalMs = 10 * 60 * 1000, log = console.log }) {
  if (!url) return null;
  const target = `${url.replace(/\/$/, '')}/api/health?keepalive=1`;
  const tick = async () => {
    if (!inWindow(new Date(), hours)) return;
    try {
      await fetch(target, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
      log(`[keepalive] ping амжилтгүй: ${err.message}`);
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  log(`[keepalive] ${target} руу ${Math.round(intervalMs / 60000)} мин тутам (${hours} цагийн хооронд, UB)`);
  return timer;
}
