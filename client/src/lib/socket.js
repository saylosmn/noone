import { io } from 'socket.io-client';
import { local, session } from './storage.js';

// Нүүр дэлгэцнээс (апп горимд) нээсэн бол апп хаагдаад дахин нээгдэхэд ч чат сэргэх ёстой
const standalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const idStore = standalone ? local : session;

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

const IDENTITY_KEY = 'noone.identity';

/** Tab бүрт тусдаа түр ID (sessionStorage). Бүртгэл, нэвтрэлт байхгүй. */
export const identity = {
  read: () => idStore.get(IDENTITY_KEY, null),
  save: (clientId, resumeToken) => idStore.set(IDENTITY_KEY, { clientId, resumeToken }),
  clear: () => idStore.remove(IDENTITY_KEY),
};

export function createSocket() {
  return io(SERVER_URL || undefined, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    auth: (cb) => cb(identity.read() || {}),
  });
}

export const apiUrl = (path) => `${SERVER_URL}${path}`;
