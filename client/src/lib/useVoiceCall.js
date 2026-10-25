import { useCallback, useEffect, useRef, useState } from 'react';

// Үнэгүй STUN. TURN нэмэх бол VITE_ICE_SERVERS-д JSON массив тавина:
// [{"urls":"stun:..."},{"urls":"turn:...","username":"..","credential":".."}]
function iceServers() {
  try {
    const custom = JSON.parse(import.meta.env.VITE_ICE_SERVERS || 'null');
    if (Array.isArray(custom) && custom.length) return custom;
  } catch {
    /* ignore */
  }
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
}

const RING_TIMEOUT_MS = 45000;
const CONNECT_TIMEOUT_MS = 20000;
const DISCONNECT_GRACE_MS = 8000;

export const callSupported = () =>
  typeof window !== 'undefined' &&
  typeof RTCPeerConnection !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const micError = (err) => {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Микрофоны зөвшөөрөл хаалттай байна. Хөтчийн тохиргооноос зөвшөөрнө үү.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'Микрофон олдсонгүй.';
  return 'Микрофоныг ашиглаж чадсангүй.';
};

/**
 * Хоёр хүний хоорондох дууны дуудлага (WebRTC, шууд холболт).
 * status: idle | calling | incoming | connecting | active
 * Дуу сервертэй огт дамжихгүй — сервер зөвхөн signaling дамжуулна.
 */
export function useVoiceCall({ roomId, chatting, partnerOnline, signal, onSignal }) {
  const [status, setStatus] = useState('idle');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState('');
  const audioRef = useRef(null);
  const statusRef = useRef('idle');
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const roleRef = useRef(null); // 'caller' | 'callee'
  const pendingIce = useRef([]);
  const timers = useRef({});
  const signalRef = useRef(signal);
  signalRef.current = signal;

  const set = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearTimers = () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  };

  const cleanup = useCallback(
    (nextNotice = '') => {
      clearTimers();
      const pc = pcRef.current;
      pcRef.current = null;
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      pendingIce.current = [];
      roleRef.current = null;
      setMuted(false);
      setSeconds(0);
      setNotice(nextNotice);
      set('idle');
    },
    [set],
  );

  // Мэдэгдлийг хэдэн секундийн дараа арилгана
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const getMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    streamRef.current = stream;
    return stream;
  }, []);

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    pcRef.current = pc;
    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
    pc.onicecandidate = (e) => {
      // null = candidate-ууд дууссан
      signalRef.current({ kind: 'ice', candidate: e.candidate ? e.candidate.toJSON() : null });
    };
    pc.ontrack = (e) => {
      if (audioRef.current) {
        audioRef.current.srcObject = e.streams[0] || new MediaStream([e.track]);
        audioRef.current.play?.().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      clearTimeout(timers.current.disconnect);
      if (pc.connectionState === 'connected') {
        clearTimeout(timers.current.connect);
        set('active');
      } else if (pc.connectionState === 'failed') {
        signalRef.current({ kind: 'end' });
        cleanup('Дуудлага холбогдсонгүй. Сүлжээ шууд холболтыг хаасан байж магадгүй.');
      } else if (pc.connectionState === 'disconnected') {
        timers.current.disconnect = setTimeout(() => {
          signalRef.current({ kind: 'end' });
          cleanup('Дуудлагын холболт тасарлаа.');
        }, DISCONNECT_GRACE_MS);
      }
    };
    timers.current.connect = setTimeout(() => {
      if (pcRef.current === pc && statusRef.current !== 'active') {
        signalRef.current({ kind: 'end' });
        cleanup('Дуудлага холбогдсонгүй. Сүлжээ шууд холболтыг хаасан байж магадгүй.');
      }
    }, CONNECT_TIMEOUT_MS);
    return pc;
  }, [cleanup, set]);

  const flushIce = async (pc) => {
    const queued = pendingIce.current.splice(0);
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* ignore */
      }
    }
  };

  // ---------- Хариу үйлдэл ----------
  useEffect(
    () =>
      onSignal(async (msg) => {
        const st = statusRef.current;
        try {
          switch (msg.kind) {
            case 'invite':
              if (st !== 'idle') {
                signalRef.current({ kind: 'busy' });
                break;
              }
              roleRef.current = 'callee';
              set('incoming');
              timers.current.ring = setTimeout(() => {
                signalRef.current({ kind: 'decline' });
                cleanup('Дуудлага алдагдлаа.');
              }, RING_TIMEOUT_MS);
              break;
            case 'accept': {
              if (st !== 'calling' || roleRef.current !== 'caller') break;
              clearTimeout(timers.current.ring);
              set('connecting');
              const pc = createPeer();
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              signalRef.current({ kind: 'offer', sdp: offer.sdp });
              break;
            }
            case 'offer': {
              const pc = pcRef.current;
              if (!pc || roleRef.current !== 'callee') break;
              await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
              await flushIce(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              signalRef.current({ kind: 'answer', sdp: answer.sdp });
              break;
            }
            case 'answer': {
              const pc = pcRef.current;
              if (!pc || roleRef.current !== 'caller') break;
              await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
              await flushIce(pc);
              break;
            }
            case 'ice': {
              if (!msg.candidate) break;
              const pc = pcRef.current;
              if (pc?.remoteDescription) await pc.addIceCandidate(msg.candidate).catch(() => {});
              else pendingIce.current.push(msg.candidate);
              break;
            }
            case 'decline':
              if (st === 'calling') cleanup('Нууц нэгэн дуудлагад хариулсангүй.');
              break;
            case 'busy':
              if (st === 'calling') cleanup('Нууц нэгэн өөр дуудлагад байна.');
              break;
            case 'end':
              if (st !== 'idle') cleanup(st === 'active' ? 'Дуудлага дууслаа.' : st === 'incoming' ? 'Дуудлага алдагдлаа.' : 'Дуудлага цуцлагдлаа.');
              break;
            default:
              break;
          }
        } catch {
          signalRef.current({ kind: 'end' });
          cleanup('Дуудлага амжилтгүй боллоо.');
        }
      }),
    [onSignal, cleanup, createPeer, set],
  );

  // ---------- Үйлдлүүд ----------
  const start = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    if (!callSupported()) {
      setNotice('Энэ хөтөч дуудлага дэмжихгүй байна.');
      return;
    }
    setNotice('');
    roleRef.current = 'caller';
    set('calling');
    try {
      await getMic();
    } catch (err) {
      cleanup(micError(err));
      return;
    }
    if (statusRef.current !== 'calling') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    const res = await signalRef.current({ kind: 'invite' });
    if (!res?.ok) {
      cleanup(
        res?.error === 'partner_offline'
          ? 'Нууц нэгэн одоо онлайн биш байна.'
          : res?.error === 'rate_limited'
            ? 'Хэт олон дуудлага хийлээ. Түр хүлээнэ үү.'
            : 'Дуудлага илгээж чадсангүй.',
      );
      return;
    }
    timers.current.ring = setTimeout(() => {
      signalRef.current({ kind: 'end' });
      cleanup('Нууц нэгэн хариулсангүй.');
    }, RING_TIMEOUT_MS);
  }, [cleanup, getMic, set]);

  const accept = useCallback(async () => {
    if (statusRef.current !== 'incoming') return;
    clearTimeout(timers.current.ring);
    try {
      await getMic();
    } catch (err) {
      signalRef.current({ kind: 'decline' });
      cleanup(micError(err));
      return;
    }
    if (statusRef.current !== 'incoming') {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    set('connecting');
    createPeer();
    signalRef.current({ kind: 'accept' });
  }, [cleanup, createPeer, getMic, set]);

  const decline = useCallback(() => {
    if (statusRef.current !== 'incoming') return;
    signalRef.current({ kind: 'decline' });
    cleanup();
  }, [cleanup]);

  const hangup = useCallback(() => {
    if (statusRef.current === 'idle') return;
    signalRef.current({ kind: 'end' });
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() || [];
    const next = !tracks.every((t) => !t.enabled);
    tracks.forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, []);

  // Чат дуусах / өрөө солигдох / нөгөө хүн гарахад дуудлагыг таслана
  useEffect(() => {
    if (statusRef.current !== 'idle') cleanup(chatting ? '' : 'Чат дууссан тул дуудлага таслагдлаа.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, chatting]);

  useEffect(() => {
    if (!partnerOnline && ['calling', 'incoming'].includes(statusRef.current)) cleanup('Нууц нэгэн гарсан бололтой.');
  }, [partnerOnline, cleanup]);

  // Ирж буй дуудлагын дуу ба чичиргээ
  useEffect(() => {
    if (status !== 'incoming') return undefined;
    let ctx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
      ctx?.resume?.().catch(() => {});
    } catch {
      ctx = null;
    }
    const ring = () => {
      navigator.vibrate?.([300, 150, 300]);
      if (!ctx || ctx.state !== 'running') return;
      for (const [offset, freq] of [
        [0, 440],
        [0.35, 520],
      ]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + offset;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    };
    ring();
    const id = setInterval(ring, 2000);
    return () => {
      clearInterval(id);
      navigator.vibrate?.(0);
      ctx?.close?.().catch(() => {});
    };
  }, [status]);

  // Ярьсан хугацаа
  useEffect(() => {
    if (status !== 'active') return undefined;
    const startedAt = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [status]);

  // Унмтрах үед микрофоныг заавал чөлөөлнө
  useEffect(() => () => cleanup(), [cleanup]);

  return { status, muted, seconds, notice, audioRef, start, accept, decline, hangup, toggleMute };
}
