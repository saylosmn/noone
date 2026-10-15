import { useCallback, useEffect, useReducer, useRef } from 'react';
import { createSocket, identity } from './socket.js';
import { PARTNER_NAME, SPAM_LIMIT, errorText, interestLabel } from './constants.js';

let seq = 0;
const sys = (text) => ({ id: `s_${Date.now()}_${(seq += 1)}`, system: true, text, ts: Date.now() });

const initialState = {
  conn: 'connecting', // connecting | online | offline
  everConnected: false,
  pushEnabled: false,
  cooldownUntil: 0,
  stats: { online: 0, waiting: { male: 0, female: 0 } },
  phase: 'idle', // idle | searching | chatting | ended
  search: { phase: 'interest', since: 0 },
  room: null,
  messages: [],
  partnerTyping: false,
  ended: null,
  pendingRating: null,
  ratings: {},
  replaced: false,
};

function matchNote(room) {
  const shared = room.sharedInterests?.length
    ? ` Та хоёр ${room.sharedInterests.map(interestLabel).join(', ')} сонирхдог.`
    : '';
  return sys(`Та нууц нэгэнтэй холбогдлоо.${shared} Мэнд мэдээд эхлээрэй!`);
}

function reducer(state, a) {
  switch (a.type) {
    case 'conn':
      return { ...state, conn: a.conn, everConnected: state.everConnected || a.conn === 'online' };
    case 'session':
      return { ...state, pushEnabled: a.pushEnabled };
    case 'cooldown':
      return { ...state, cooldownUntil: a.until };
    case 'stats':
      return { ...state, stats: a.stats };
    case 'searching':
      return {
        ...state,
        phase: 'searching',
        search: { phase: a.searchPhase || 'interest', since: Date.now() },
        room: null,
        messages: [],
        partnerTyping: false,
        ended: null,
        pendingRating: a.pendingRating ?? null,
      };
    case 'search_status':
      return state.phase === 'searching' ? { ...state, search: { phase: a.phase, since: a.since } } : state;
    case 'idle':
      return { ...state, phase: 'idle', room: null, messages: [], partnerTyping: false, ended: null, pendingRating: null };
    case 'matched':
      return {
        ...state,
        phase: 'chatting',
        room: a.room,
        messages: [matchNote(a.room)],
        partnerTyping: false,
        ended: null,
        pendingRating: null,
      };
    case 'resumed':
      return {
        ...state,
        phase: 'chatting',
        room: a.room,
        ended: null,
        messages: a.keepMessages
          ? [...state.messages, sys('Холболт сэргэлээ. Чат үргэлжилж байна.')]
          : [sys('Чат сэргэлээ. Өмнөх мессежүүд хаана ч хадгалагддаггүй тул харагдахгүй.')],
      };
    case 'ended':
      if (state.phase !== 'chatting') return state;
      return {
        ...state,
        phase: 'ended',
        partnerTyping: false,
        ended: { reason: a.reason, roomId: state.room?.roomId, at: Date.now() },
        room: state.room ? { ...state.room, partner: { ...state.room.partner, online: false } } : null,
      };
    case 'add_message':
      return { ...state, messages: [...state.messages, a.message] };
    case 'update_message':
      return { ...state, messages: state.messages.map((m) => (m.id === a.id ? { ...m, ...a.patch } : m)) };
    case 'typing':
      return { ...state, partnerTyping: a.typing };
    case 'partner_status':
      if (state.phase !== 'chatting' || !state.room || state.room.partner.online === a.online) return state;
      return {
        ...state,
        partnerTyping: a.online ? state.partnerTyping : false,
        room: { ...state.room, partner: { ...state.room.partner, online: a.online } },
        messages: [
          ...state.messages,
          sys(a.online ? 'Нөгөө хүн буцаж холбогдлоо.' : 'Нөгөө хүний холболт тасарлаа. Түр хүлээж байна…'),
        ],
      };
    case 'rated':
      return { ...state, ratings: { ...state.ratings, [a.roomId]: a.rating } };
    case 'dismiss_rating':
      return { ...state, pendingRating: null };
    case 'replaced':
      return { ...state, replaced: true, conn: 'offline' };
    default:
      return state;
  }
}

/**
 * Socket.IO-той харилцах бүх логик.
 * profileRef — { gender, interests } (дахин холбогдоход дараалалд дахин орохын тулд)
 */
export function useChat({ profileRef, onIncoming, onMatch, onToast, onSession }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const cbRef = useRef({});
  cbRef.current = { onIncoming, onMatch, onToast, onSession };
  const socketRef = useRef(null);
  const typingTimer = useRef(null);

  const request = useCallback(
    (event, payload, timeout = 8000) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) return resolve({ ok: false, error: 'offline' });
        socket.timeout(timeout).emit(event, payload ?? {}, (err, res) => {
          if (err) resolve({ ok: false, error: 'timeout' });
          else resolve(res || { ok: false, error: 'server_error' });
        });
      }),
    [],
  );

  const toast = (text, tone = 'error') => cbRef.current.onToast?.(text, tone);

  const joinQueue = useCallback(
    async (profile) => {
      const res = await request('queue:join', {
        gender: profile.gender,
        interests: profile.interests,
        adultConfirmed: true,
      });
      if (!res.ok && stateRef.current.phase === 'searching') {
        toast(errorText(res.error));
        dispatch({ type: 'idle' });
      }
      return res;
    },
    [request],
  );

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => dispatch({ type: 'conn', conn: 'online' }));
    socket.on('disconnect', () => {
      dispatch({ type: 'conn', conn: 'offline' });
      dispatch({ type: 'typing', typing: false });
    });
    socket.on('connect_error', () => {
      dispatch({ type: 'conn', conn: stateRef.current.everConnected ? 'offline' : 'connecting' });
    });

    socket.on('session', (s) => {
      identity.save(s.clientId, s.resumeToken);
      dispatch({ type: 'session', pushEnabled: s.pushEnabled });
      const cur = stateRef.current;
      const srv = s.state || {};
      if (srv.status === 'chatting' && srv.room) {
        const same = cur.phase === 'chatting' && cur.room?.roomId === srv.room.roomId;
        dispatch({ type: 'resumed', room: srv.room, keepMessages: same });
      } else if (cur.phase === 'chatting') {
        dispatch({ type: 'ended', reason: 'connection_lost' });
      } else if (cur.phase === 'searching' && profileRef.current?.gender) {
        joinQueue(profileRef.current);
      }
      cbRef.current.onSession?.(s);
    });

    socket.on('session:replaced', () => {
      identity.clear();
      dispatch({ type: 'replaced' });
    });

    socket.on('stats', (stats) => dispatch({ type: 'stats', stats }));
    socket.on('queue:status', (s) => dispatch({ type: 'search_status', phase: s.phase, since: s.since }));

    socket.on('match:found', (m) => {
      dispatch({
        type: 'matched',
        room: {
          roomId: m.roomId,
          startedAt: m.startedAt,
          sharedInterests: m.sharedInterests || [],
          partner: { nickname: PARTNER_NAME, online: m.partner?.online !== false },
        },
      });
      cbRef.current.onMatch?.(m);
    });

    socket.on('chat:message', (m) => {
      if (stateRef.current.phase !== 'chatting') return;
      clearTimeout(typingTimer.current);
      dispatch({ type: 'typing', typing: false });
      dispatch({
        type: 'add_message',
        message: { id: m.id, text: m.text, ts: m.ts, replyTo: m.replyTo || null, mine: false, status: 'received' },
      });
      cbRef.current.onIncoming?.(m);
    });

    socket.on('chat:typing', ({ typing }) => {
      clearTimeout(typingTimer.current);
      dispatch({ type: 'typing', typing: Boolean(typing) });
      if (typing) typingTimer.current = setTimeout(() => dispatch({ type: 'typing', typing: false }), 5000);
    });

    socket.on('chat:partner_status', ({ online }) => dispatch({ type: 'partner_status', online }));

    socket.on('chat:ended', ({ roomId, reason }) => {
      if (stateRef.current.room?.roomId !== roomId) return;
      dispatch({ type: 'ended', reason });
    });

    socket.connect();

    const onVisibility = () => {
      if (socket.connected) socket.emit('presence:visibility', { visible: document.visibilityState === 'visible' });
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(typingTimer.current);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [joinQueue, profileRef]);

  // ---------- Үйлдлүүд ----------
  const startSearch = useCallback(
    async (profile) => {
      dispatch({ type: 'searching' });
      return joinQueue(profile);
    },
    [joinQueue],
  );

  const cancelSearch = useCallback(async () => {
    dispatch({ type: 'idle' });
    await request('queue:leave');
  }, [request]);

  const next = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.phase === 'chatting') {
      dispatch({ type: 'searching', pendingRating: { roomId: cur.room.roomId } });
      const res = await request('chat:next');
      if (!res.ok) {
        toast(errorText(res.error));
        // Офлайн бол хүлээлгийн дэлгэц дээр үлдэнэ — дахин холбогдоход автоматаар дараалалд орно
        if (res.error !== 'offline') dispatch({ type: 'idle' });
      }
      return;
    }
    if (profileRef.current?.gender) await startSearch(profileRef.current);
  }, [request, startSearch, profileRef]);

  // Клиент талын token bucket — 10-аас олон мессеж хурдан бичвэл серверт хүргэхгүй, "Түр хүлээнэ үү" гэж харуулна
  const bucket = useRef({ tokens: SPAM_LIMIT.burst, last: Date.now() });
  const startCooldown = useCallback((ms = SPAM_LIMIT.cooldownMs) => {
    dispatch({ type: 'cooldown', until: Date.now() + Math.max(ms, SPAM_LIMIT.cooldownMs) });
  }, []);

  /** Илгээж болох эсэх (синхрон). true бол нэг "token" хэрэглэнэ. */
  const takeSendToken = useCallback(() => {
    const now = Date.now();
    if (stateRef.current.cooldownUntil > now) return false;
    const b = bucket.current;
    b.tokens = Math.min(SPAM_LIMIT.burst, b.tokens + ((now - b.last) / 1000) * SPAM_LIMIT.perSecond);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    startCooldown();
    return false;
  }, [startCooldown]);

  const sendMessage = useCallback(
    async (text, replyTo = null) => {
      const clean = text.trim();
      if (!clean || stateRef.current.phase !== 'chatting') return false;
      const tempId = `tmp_${Date.now()}_${(seq += 1)}`;
      dispatch({
        type: 'add_message',
        message: { id: tempId, text: clean, ts: Date.now(), replyTo, mine: true, status: 'sending' },
      });
      const res = await request('chat:message', { text: clean, replyTo });
      if (res.ok) {
        dispatch({ type: 'update_message', id: tempId, patch: { id: res.id, ts: res.ts, status: 'sent' } });
        return true;
      }
      dispatch({ type: 'update_message', id: tempId, patch: { status: 'failed', error: res.error } });
      if (res.error === 'rate_limited') startCooldown(res.retryAfterMs);
      else toast(errorText(res.error));
      return false;
    },
    [request, startCooldown],
  );

  const retryMessage = useCallback(
    async (id) => {
      const msg = stateRef.current.messages.find((m) => m.id === id);
      if (!msg || msg.status !== 'failed') return;
      if (!takeSendToken()) return;
      dispatch({ type: 'update_message', id, patch: { status: 'sending', error: null } });
      const res = await request('chat:message', { text: msg.text, replyTo: msg.replyTo });
      if (res.ok) {
        dispatch({ type: 'update_message', id, patch: { id: res.id, ts: res.ts, status: 'sent' } });
      } else {
        dispatch({ type: 'update_message', id, patch: { status: 'failed', error: res.error } });
        if (res.error === 'rate_limited') startCooldown(res.retryAfterMs);
        else toast(errorText(res.error));
      }
    },
    [request, takeSendToken, startCooldown],
  );

  const setTyping = useCallback((typing) => {
    const socket = socketRef.current;
    if (socket?.connected && stateRef.current.phase === 'chatting') socket.emit('chat:typing', { typing });
  }, []);

  const leave = useCallback(async () => {
    dispatch({ type: 'ended', reason: 'you_left' });
    await request('chat:leave');
  }, [request]);

  const block = useCallback(async () => {
    const wasChatting = stateRef.current.phase === 'chatting';
    const res = await request('chat:block');
    if (!res.ok) return toast(errorText(res.error));
    if (wasChatting) dispatch({ type: 'ended', reason: 'you_blocked' });
    else toast('Блоклолоо. Энэ хүнтэй дахин тааралдахгүй.', 'success');
  }, [request]);

  const report = useCallback(
    async (reason) => {
      const wasChatting = stateRef.current.phase === 'chatting';
      const res = await request('chat:report', { reason });
      if (!res.ok) {
        toast(errorText(res.error));
        return false;
      }
      if (wasChatting) dispatch({ type: 'ended', reason: 'you_reported' });
      else toast('Мэдээлэл илгээгдлээ. Энэ хүн блоклогдсон.', 'success');
      return true;
    },
    [request],
  );

  const rate = useCallback(
    async (roomId, rating) => {
      dispatch({ type: 'rated', roomId, rating });
      await request('chat:rate', { roomId, rating });
    },
    [request],
  );

  const dismissRating = useCallback(() => dispatch({ type: 'dismiss_rating' }), []);

  const goHome = useCallback(async () => {
    const phase = stateRef.current.phase;
    dispatch({ type: 'idle' });
    if (phase === 'chatting') await request('chat:leave');
    if (phase === 'searching') await request('queue:leave');
  }, [request]);

  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket && !socket.connected) {
      dispatch({ type: 'conn', conn: 'connecting' });
      socket.connect();
    }
  }, []);

  const restartFresh = useCallback(() => {
    identity.clear();
    window.location.reload();
  }, []);

  const sendPushSubscription = useCallback(
    (subscription) => request('push:subscribe', { subscription }),
    [request],
  );
  const removePushSubscription = useCallback(() => request('push:unsubscribe'), [request]);

  return {
    state,
    actions: {
      startSearch,
      cancelSearch,
      next,
      sendMessage,
      takeSendToken,
      retryMessage,
      setTyping,
      leave,
      block,
      report,
      rate,
      dismissRating,
      goHome,
      reconnect,
      restartFresh,
      sendPushSubscription,
      removePushSubscription,
    },
  };
}
