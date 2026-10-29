import { useCallback, useEffect, useReducer, useRef } from 'react';
import { createSocket, identity } from './socket.js';
import { PARTNER_NAME, SPAM_LIMIT, errorText, interestLabel, platformLabel, schoolLabel } from './constants.js';

let seq = 0;
const sys = (text) => ({ id: `s_${Date.now()}_${(seq += 1)}`, system: true, text, ts: Date.now() });

const EMPTY_FRIEND = { mine: null, partnerOffered: false, partnerContact: null };

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
  friend: EMPTY_FRIEND,
  partnerTyping: false,
  ended: null,
  pendingRating: null,
  ratings: {},
  replaced: false,
};

function matchNote(room) {
  const parts = [];
  if (room.sharedSchool) parts.push(`хоёулаа ${schoolLabel(room.sharedSchool)}-д сурдаг`);
  if (room.sharedInterests?.length) parts.push(`${room.sharedInterests.map(interestLabel).join(', ')} сонирхдог`);
  const common = parts.length ? ` Та хоёр ${parts.join(', ')}.` : '';
  return sys(`Та нууц нэгэнтэй холбогдлоо.${common} Мэнд мэдээд эхлээрэй!`);
}

const toRoom = (r) => ({
  roomId: r.roomId,
  startedAt: r.startedAt,
  mode: r.mode || 'chat',
  blind: r.blind || null,
  sharedInterests: r.sharedInterests || [],
  sharedSchool: r.sharedSchool || null,
  partner: { nickname: PARTNER_NAME, online: r.partner?.online !== false },
});

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
        friend: EMPTY_FRIEND,
        partnerTyping: false,
        ended: null,
        pendingRating: a.pendingRating ?? null,
      };
    case 'search_status':
      return state.phase === 'searching' ? { ...state, search: { phase: a.phase, since: a.since } } : state;
    case 'idle':
      return { ...state, phase: 'idle', room: null, messages: [], friend: EMPTY_FRIEND, partnerTyping: false, ended: null, pendingRating: null };
    case 'matched':
      return {
        ...state,
        phase: 'chatting',
        room: a.room,
        messages: [matchNote(a.room)],
        friend: EMPTY_FRIEND,
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
        friend: a.friend || EMPTY_FRIEND,
        messages: a.keepMessages
          ? [...state.messages, sys('Холболт сэргэлээ. Чат үргэлжилж байна.')]
          : [sys('Чат сэргэлээ. Өмнө хүргэсэн мессежийн түүх серверт хадгалагддаггүй тул харагдахгүй.')],
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
    case 'unsent':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === a.id ? { ...m, unsent: true, text: '', sticker: null, replyTo: null, reactions: {} } : m,
        ),
      };
    case 'seen': {
      // Тэр мессеж болон түүнээс өмнөх миний бүх мессежийг "Харсан" болгоно
      const idx = state.messages.findIndex((m) => m.id === a.id);
      if (idx < 0) return state;
      let changed = false;
      const messages = state.messages.map((m, i) => {
        if (i > idx || !m.mine || m.status !== 'sent') return m;
        changed = true;
        return { ...m, status: 'seen' };
      });
      return changed ? { ...state, messages } : state;
    }
    case 'reaction':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === a.messageId ? { ...m, reactions: { ...(m.reactions || {}), [a.who]: a.emoji } } : m,
        ),
      };
    case 'friend':
      return {
        ...state,
        friend: { ...state.friend, ...a.patch },
        messages: a.note ? [...state.messages, a.note] : state.messages,
      };
    case 'date':
      return state.phase === 'chatting' && state.room?.roomId === a.roomId
        ? { ...state, room: { ...state.room, blind: a.blind } } : state;
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
          sys(
            a.online
              ? 'Үл таних хүн буцаж ирлээ.'
              : 'Үл таних хүн гарсан эсвэл холболт нь тасарсан бололтой. Хүлээж болно, эсвэл “Дараагийн” дарна уу.',
          ),
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
  const callListeners = useRef(new Set());
  const typingTimer = useRef(null);
  const lastSeenSent = useRef(null);

  /** Нөгөө хүний хамгийн сүүлийн мессежийг "харсан" гэж мэдэгдэнэ (хуудас харагдаж байх үед л). */
  const reportSeen = useCallback((messageId) => {
    const socket = socketRef.current;
    if (!messageId || messageId === lastSeenSent.current || !socket?.connected) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (stateRef.current.phase !== 'chatting') return;
    lastSeenSent.current = messageId;
    socket.emit('chat:seen', { messageId });
  }, []);
  const lastReceivedId = () => {
    const list = stateRef.current.messages;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const m = list[i];
      if (!m.mine && !m.system && !m.unsent && /^m_/.test(m.id)) return m.id;
    }
    return null;
  };

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
        school: profile.school || null,
        adultConfirmed: profile.adultConfirmed === true,
        mode: profile.mode || 'chat',
      });
      if (!res.ok) {
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
        const f = srv.room.friend || {};
        dispatch({
          type: 'resumed',
          room: toRoom(srv.room),
          keepMessages: same,
          friend: { mine: f.mine || null, partnerOffered: Boolean(f.partnerOffered), partnerContact: f.partnerContact || null },
        });
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

    socket.on('date:state', (s) => dispatch({ type: 'date', ...s }));
    socket.on('queue:closed', () => {
      dispatch({ type: 'idle' });
      toast(errorText('date_closed'));
    });
    socket.on('stats', (stats) => dispatch({ type: 'stats', stats }));
    socket.on('queue:status', (s) => dispatch({ type: 'search_status', phase: s.phase, since: s.since }));

    socket.on('match:found', (m) => {
      lastSeenSent.current = null;
      dispatch({
        type: 'matched',
        room: toRoom(m),
      });
      cbRef.current.onMatch?.(m);
    });

    socket.on('chat:message', (m) => {
      if (stateRef.current.phase !== 'chatting') return;
      clearTimeout(typingTimer.current);
      dispatch({ type: 'typing', typing: false });
      dispatch({
        type: 'add_message',
        message: {
          id: m.id,
          text: m.text ?? '',
          sticker: m.sticker || null,
          ts: m.ts,
          replyTo: m.replyTo || null,
          mine: false,
          status: 'received',
        },
      });
      cbRef.current.onIncoming?.(m);
      reportSeen(m.id);
    });

    socket.on('chat:seen', ({ messageId }) => dispatch({ type: 'seen', id: messageId }));
    socket.on('chat:unsent', ({ messageId }) => dispatch({ type: 'unsent', id: messageId }));

    socket.on('chat:typing', ({ typing }) => {
      clearTimeout(typingTimer.current);
      dispatch({ type: 'typing', typing: Boolean(typing) });
      if (typing) typingTimer.current = setTimeout(() => dispatch({ type: 'typing', typing: false }), 5000);
    });

    socket.on('chat:reaction', ({ messageId, emoji }) => {
      dispatch({ type: 'reaction', messageId, who: 'theirs', emoji: emoji || null });
    });

    socket.on('friend:requested', () => {
      if (stateRef.current.phase !== 'chatting') return;
      dispatch({
        type: 'friend',
        patch: { partnerOffered: true },
        note: sys('Нууц нэгэн найз болох хүсэлт илгээлээ. Та ч бас зөвшөөрвөл хаягаа солилцоно.'),
      });
      cbRef.current.onIncoming?.({});
    });
    socket.on('friend:cancelled', () => dispatch({ type: 'friend', patch: { partnerOffered: false } }));
    socket.on('friend:reveal', ({ contact }) => {
      dispatch({
        type: 'friend',
        patch: { partnerOffered: true, partnerContact: contact },
        note: { ...sys(''), contact },
      });
      cbRef.current.onIncoming?.({});
    });

    socket.on('call:signal', (msg) => callListeners.current.forEach((fn) => fn(msg)));
    socket.on('chat:partner_status', ({ online }) => dispatch({ type: 'partner_status', online }));

    socket.on('chat:ended', ({ roomId, reason }) => {
      if (stateRef.current.room?.roomId !== roomId) return;
      dispatch({ type: 'ended', reason });
    });

    socket.connect();

    const onVisibility = () => {
      if (socket.connected) socket.emit('presence:visibility', { visible: document.visibilityState === 'visible' });
      if (document.visibilityState === 'visible') reportSeen(lastReceivedId());
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(typingTimer.current);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [joinQueue, profileRef, reportSeen]);

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
    async (text, replyTo = null, sticker = null) => {
      const clean = sticker ? '' : text.trim();
      if ((!clean && !sticker) || stateRef.current.phase !== 'chatting') return false;
      const tempId = `tmp_${Date.now()}_${(seq += 1)}`;
      dispatch({
        type: 'add_message',
        message: { id: tempId, text: clean, sticker, ts: Date.now(), replyTo, mine: true, status: 'sending' },
      });
      const res = await request('chat:message', sticker ? { sticker, replyTo } : { text: clean, replyTo });
      if (res.ok) {
        const patch = { id: res.id, ts: res.ts, sentAt: Date.now(), status: 'sent' };
        if (res.text) patch.text = res.text; // хараалын үг шүүгдсэн хэлбэр
        dispatch({ type: 'update_message', id: tempId, patch });
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
      const res = await request(
        'chat:message',
        msg.sticker ? { sticker: msg.sticker, replyTo: msg.replyTo } : { text: msg.text, replyTo: msg.replyTo },
      );
      if (res.ok) {
        dispatch({ type: 'update_message', id, patch: { id: res.id, ts: res.ts, sentAt: Date.now(), status: 'sent', ...(res.text ? { text: res.text } : {}) } });
      } else {
        dispatch({ type: 'update_message', id, patch: { status: 'failed', error: res.error } });
        if (res.error === 'rate_limited') startCooldown(res.retryAfterMs);
        else toast(errorText(res.error));
      }
    },
    [request, takeSendToken, startCooldown],
  );

  const react = useCallback(
    async (messageId, emoji) => {
      const msg = stateRef.current.messages.find((m) => m.id === messageId);
      if (!msg || msg.system || stateRef.current.phase !== 'chatting') return;
      const next = msg.reactions?.mine === emoji ? null : emoji; // дахин дарвал арилна
      dispatch({ type: 'reaction', messageId, who: 'mine', emoji: next });
      const res = await request('chat:react', { messageId, emoji: next });
      if (!res.ok) {
        dispatch({ type: 'reaction', messageId, who: 'mine', emoji: msg.reactions?.mine || null });
        if (res.error !== 'rate_limited') toast(errorText(res.error));
      }
    },
    [request],
  );

  const unsend = useCallback(
    async (messageId) => {
      const msg = stateRef.current.messages.find((m) => m.id === messageId);
      if (!msg?.mine || msg.unsent || stateRef.current.phase !== 'chatting') return false;
      const res = await request('chat:unsend', { messageId });
      if (!res.ok) {
        toast(errorText(res.error));
        return false;
      }
      dispatch({ type: 'unsent', id: messageId });
      return true;
    },
    [request],
  );

  const offerFriend = useCallback(
    async (platform, handle) => {
      const res = await request('friend:offer', { platform, handle });
      if (!res.ok) {
        toast(errorText(res.error));
        return res;
      }
      const mine = { platform, handle: handle.trim() };
      if (res.status === 'revealed') {
        dispatch({
          type: 'friend',
          patch: { mine, partnerOffered: true, partnerContact: res.contact },
          note: { ...sys(''), contact: res.contact },
        });
      } else {
        dispatch({
          type: 'friend',
          patch: { mine },
          note: sys(`Найз болох хүсэлт илгээлээ (${platformLabel(platform)}). Нөгөө хүн зөвшөөрвөл хаягаа солилцоно.`),
        });
      }
      return res;
    },
    [request],
  );

  const cancelFriend = useCallback(async () => {
    const res = await request('friend:cancel');
    if (res.ok) dispatch({ type: 'friend', patch: { mine: null }, note: sys('Найз болох хүсэлтээ цуцаллаа.') });
    return res;
  }, [request]);

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

  // Дууны дуудлагын signaling (useVoiceCall ашиглана)
  const callSignal = useCallback((payload) => request('call:signal', payload, 5000), [request]);
  const onCallSignal = useCallback((fn) => {
    callListeners.current.add(fn);
    return () => callListeners.current.delete(fn);
  }, []);

  return {
    state,
    actions: {
      startSearch,
      cancelSearch,
      broadenSearch: async () => {
        const res = await request('queue:broaden');
        if (!res.ok) toast(errorText(res.error));
        return res;
      },
      advanceDate: async (ready) => {
        const room = stateRef.current.room;
        const res = await request('date:advance', { roomId: room?.roomId, stage: room?.blind?.stage, ready });
        if (!res.ok) toast(errorText(res.error));
        return res;
      },
      shareDateProfile: async (profile) => {
        const res = await request('date:profile', { ...profile, roomId: stateRef.current.room?.roomId });
        if (!res.ok) toast(errorText(res.error));
        return res;
      },
      next,
      sendMessage,
      takeSendToken,
      react,
      unsend,
      offerFriend,
      cancelFriend,
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
      callSignal,
      onCallSignal,
    },
  };
}
