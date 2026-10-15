import { useEffect, useRef, useState } from 'react';

/* global __BUILD_ID__ */
const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

/**
 * Шинэ хувилбар гарсан эсэхийг 60 сек тутам болон tab руу буцаж ороход шалгана.
 * Чатлаагүй үед автоматаар шинэчилнэ; чатлаж байвал товч санал болгоно.
 */
export function useUpdateCheck(busy) {
  const [available, setAvailable] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (CURRENT === 'dev') return undefined;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = await res.json();
        if (stopped || !id || id === CURRENT) return;
        if (!busyRef.current) window.location.reload();
        else setAvailable(true);
      } catch {
        /* офлайн — дараа дахин */
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    const timer = setInterval(check, 60000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  // Чат дуусаад завтай болмогц шинэчилнэ
  useEffect(() => {
    if (available && !busy) window.location.reload();
  }, [available, busy]);

  return available;
}
