import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CONTACT_PLATFORMS,
  ENDED_TEXT,
  MAX_MESSAGE_LENGTH,
  PARTNER_NAME,
  REACTIONS,
  REPORT_REASONS,
  UNSEND_WINDOW_MS,
  errorText,
  interestLabel,
  platformLabel,
  schoolLabel,
} from '../lib/constants.js';
import { formatTime, snippet } from '../lib/format.js';
import { pickIcebreaker } from '../lib/icebreakers.js';
import { Icon } from './Icon.jsx';
import { ConfirmDialog, Modal } from './Modal.jsx';
import { RatingCard } from './Feedback.jsx';
import { STICKERS, Sticker, stickerLabel } from './Sticker.jsx';

const isCoarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

function Avatar() {
  return (
    <span className="avatar" aria-hidden="true">
      <Icon name="mask" size={22} />
    </span>
  );
}

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, until - now);
}

// ---------------- Цэс ----------------
function Menu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Бусад үйлдэл"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items
            .filter((i) => !i.hidden)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`menu-item ${item.danger ? 'is-danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Мессеж ----------------
const previewText = (m) => (m.unsent ? 'Буцаасан мессеж' : m.sticker ? `Стикер · ${stickerLabel(m.sticker)}` : snippet(m.text, 80));

function ContactCard({ contact }) {
  const [copied, setCopied] = useState(false);
  const platform = CONTACT_PLATFORMS.find((p) => p.id === contact.platform);
  const link = platform?.url?.(contact.handle);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="contact-card" role="note">
      <div className="contact-title">
        <Icon name="heartHand" size={18} /> Та хоёр найз боллоо!
      </div>
      <p className="contact-sub">Нууц нэгний хаяг:</p>
      <div className="contact-row">
        <span className="contact-platform">{platformLabel(contact.platform)}</span>
        <span className="contact-handle">{contact.handle}</span>
      </div>
      <div className="contact-actions">
        <button type="button" className="btn sm ghost" onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Хуулагдлаа' : 'Хуулах'}
        </button>
        {link && (
          <a className="btn sm primary" href={link} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} /> Нээх
          </a>
        )}
      </div>
    </div>
  );
}

function ReactionPicker({ current, onPick, onClose, side, onReply, onCopy, onUnsend }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    // Нээсэн даруйд ирэх "click"-ийг алгасахын тулд дараагийн tick-д бүртгэнэ
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className={`reaction-picker ${side}`} ref={ref} role="menu" aria-label="Мессежийн үйлдэл">
      <div className="reaction-row">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="menuitem"
            className={`reaction-option ${current === emoji ? 'is-active' : ''}`}
            aria-label={`${emoji} reaction`}
            onClick={() => {
              onPick(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      {(onReply || onCopy || onUnsend) && (
        <div className="sheet-actions">
          {onReply && (
            <button
              type="button"
              role="menuitem"
              className="sheet-action"
              onClick={() => {
                onReply();
                onClose();
              }}
            >
              <Icon name="reply" size={18} /> Хариулах
            </button>
          )}
          {onCopy && (
            <button
              type="button"
              role="menuitem"
              className="sheet-action"
              onClick={() => {
                onCopy();
                onClose();
              }}
            >
              <Icon name="copy" size={18} /> Хуулах
            </button>
          )}
          {onUnsend && (
            <button
              type="button"
              role="menuitem"
              className="sheet-action is-danger"
              onClick={() => {
                onUnsend();
                onClose();
              }}
            >
              <Icon name="undo" size={18} /> Буцаах
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ message, original, partnerName, onReply, onReact, onUnsend, onJump, onRetry, grouped, highlighted, seenLabel }) {
  const rowRef = useRef(null);
  const touch = useRef(null);
  const pressTimer = useRef(null);
  const [picker, setPicker] = useState(false);
  const live = !message.system && !message.unsent && message.status !== 'sending' && message.status !== 'failed';
  const canReply = Boolean(onReply) && live;
  const canReact = Boolean(onReact) && live && !message.id.startsWith('tmp_');
  // Буцаах боломжтой эсэхийг дарах үед дахин шалгана (хугацаа өнгөрч болно)
  const withinUnsend = () => Date.now() - (message.sentAt || 0) < UNSEND_WINDOW_MS;
  const canUnsend = Boolean(onUnsend) && live && message.mine && Boolean(message.sentAt) && withinUnsend();

  const clearPress = () => clearTimeout(pressTimer.current);
  const [sheet, setSheet] = useState(false); // утсан дээрх удаан дарах цэс
  const openSheet = () => {
    if (!canReact && !canReply) return;
    navigator.vibrate?.(15);
    setSheet(true);
  };
  // Хажуу тийш шудрах үйлдэл байхгүй — зөвхөн удаан дарах (iOS) / contextmenu (Android, баруун товч)
  const onTouchStart = (e) => {
    if (!canReact && !canReply) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
    clearPress();
    pressTimer.current = setTimeout(() => {
      touch.current = null;
      openSheet();
    }, 450);
  };
  const onTouchMove = (e) => {
    const s0 = touch.current;
    if (!s0) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - s0.x) > 8 || Math.abs(t.clientY - s0.y) > 8) {
      clearPress();
      touch.current = null;
    }
  };
  const onTouchEnd = () => {
    clearPress();
    touch.current = null;
  };
  useEffect(() => clearPress, []);
  const copyText = message.text
    ? () => navigator.clipboard?.writeText(message.text).catch(() => {})
    : null;

  if (message.contact) return <ContactCard contact={message.contact} />;
  if (message.system) {
    return (
      <div className="system-note" role="note">
        {message.text}
      </div>
    );
  }
  if (message.unsent) {
    return (
      <div id={`msg-${message.id}`} className={`msg-row ${message.mine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
        <div className="bubble is-unsent">
          <p className="msg-text">{message.mine ? 'Та мессежээ буцаасан' : 'Нууц нэгэн мессежээ буцаасан'}</p>
        </div>
      </div>
    );
  }

  const quoteAuthor = original ? (original.mine ? 'Та' : partnerName) : '';
  const reactions = message.reactions || {};
  const shown = [reactions.theirs, reactions.mine].filter(Boolean);
  const isSticker = Boolean(message.sticker);
  return (
    <div
      id={`msg-${message.id}`}
      ref={rowRef}
      className={`msg-row ${message.mine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''} ${highlighted ? 'is-flash' : ''} ${shown.length ? 'has-reactions' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={(e) => {
        if (!canReact && !canReply) return;
        e.preventDefault();
        clearPress();
        openSheet();
      }}
    >
      <div
        className={`bubble ${isSticker ? 'is-sticker' : ''} ${message.status === 'failed' ? 'is-failed' : ''}`}
        onDoubleClick={(e) => {
          if (e.target.closest('.quote')) return;
          window.getSelection?.()?.removeAllRanges();
          // Утсан дээр: Instagram шиг давхар товшиход ❤️. Компьютер дээр: хариулах.
          if (isCoarse()) {
            if (canReact) onReact(message.id, '❤️');
          } else if (canReply) {
            onReply(message);
          }
        }}
        title={canReply && !isCoarse() ? 'Давхар дарж хариулах' : undefined}
      >
        {message.replyTo && (
          <button
            type="button"
            className="quote"
            onClick={() => original && onJump(message.replyTo)}
            disabled={!original}
            aria-label={original ? `Эх мессеж рүү очих: ${previewText(original)}` : 'Эх мессеж олдсонгүй'}
          >
            <span className="quote-author">{quoteAuthor || 'Хариулт'}</span>
            <span className="quote-text">{original ? previewText(original) : 'Эх мессеж олдсонгүй'}</span>
          </button>
        )}
        {isSticker ? <Sticker id={message.sticker} size={118} /> : <p className="msg-text">{message.text}</p>}
        <span className="msg-meta">
          {formatTime(message.ts)}
          {message.mine && message.status === 'sending' && <Icon name="clock" size={12} />}
          {message.mine && message.status === 'sent' && <Icon name="check" size={12} strokeWidth={3} />}
          {message.mine && message.status === 'seen' && <Icon name="checks" size={14} strokeWidth={2.6} />}
          {message.status === 'failed' && <Icon name="alert" size={12} />}
        </span>
        {shown.length > 0 && (
          <button
            type="button"
            className="reaction-badge"
            onClick={() => canReact && setPicker(true)}
            aria-label={`Reaction: ${shown.join(' ')}`}
          >
            {reactions.theirs === reactions.mine && reactions.mine ? (
              <>
                {reactions.mine}
                <span className="reaction-count">2</span>
              </>
            ) : (
              shown.map((r, i) => <span key={`${r}${i}`}>{r}</span>)
            )}
          </button>
        )}
      </div>
      <div className="msg-actions">
        {canUnsend && (
          <button
            type="button"
            className="reply-btn unsend-btn"
            aria-label="Мессежээ буцаах"
            title="Буцаах (1 минутын дотор)"
            onClick={() => onUnsend(message.id)}
          >
            <Icon name="undo" size={16} />
          </button>
        )}
        {canReact && (
          <button
            type="button"
            className="reply-btn react-btn"
            aria-label="Reaction үлдээх"
            title="Reaction"
            aria-expanded={picker}
            onClick={() => setPicker((p) => !p)}
          >
            <Icon name="smilePlus" size={16} />
          </button>
        )}
        {canReply && (
          <button type="button" className="reply-btn" aria-label="Хариулах" title="Хариулах" onClick={() => onReply(message)}>
            <Icon name="reply" size={16} />
          </button>
        )}
      </div>
      {(picker || sheet) && (
        <ReactionPicker
          current={reactions.mine}
          side={message.mine ? 'right' : 'left'}
          onPick={(emoji) => canReact && onReact(message.id, emoji)}
          onClose={() => {
            setPicker(false);
            setSheet(false);
          }}
          onReply={sheet && canReply ? () => onReply(message) : null}
          onCopy={sheet ? copyText : null}
          onUnsend={sheet && canUnsend ? () => withinUnsend() && onUnsend(message.id) : null}
        />
      )}
      {seenLabel && <span className="seen-label">Харсан</span>}
      {message.status === 'failed' && (
        <button type="button" className="retry-btn" onClick={() => onRetry(message.id)}>
          <span title={errorText(message.error)}>Илгээгдсэнгүй</span> · Дахин оролдох
        </button>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg-row theirs typing-row" aria-label="Бичиж байна">
      <div className="bubble typing-bubble">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function MessageList({ messages, partnerTyping, partnerName, onReply, onReact, onUnsend, onRetry, jumpRef, footer }) {
  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const [newCount, setNewCount] = useState(0);
  const [flashId, setFlashId] = useState(null);
  const prevLen = useRef(messages.length);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  // "Харсан" гэсэн бичгийг миний хамгийн сүүлийн мессежийн доор л харуулна
  const seenId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.system || m.contact) continue;
      if (!m.mine) return null;
      if (!m.unsent) return m.status === 'seen' ? m.id : null;
    }
    return null;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setNewCount(0);
  }, []);

  const jumpTo = useCallback((id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(null);
    requestAnimationFrame(() => setFlashId(id));
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }, []);

  useEffect(() => {
    jumpRef.current = { jumpTo, scrollToBottom };
  }, [jumpRef, jumpTo, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottomRef.current) setNewCount(0);
  };

  useLayoutEffect(() => {
    const added = messages.slice(prevLen.current);
    prevLen.current = messages.length;
    if (!added.length) return;
    const mineAdded = added.some((m) => m.mine);
    if (atBottomRef.current || mineAdded) {
      scrollToBottom(added.length < 3);
    } else {
      setNewCount((n) => n + added.filter((m) => !m.mine && !m.system).length);
    }
  }, [messages, scrollToBottom]);

  useLayoutEffect(() => {
    if (partnerTyping && atBottomRef.current) scrollToBottom();
  }, [partnerTyping, scrollToBottom]);

  // Чат дуусахад төгсгөлийн карт харагдахаар доош гүйлгэнэ
  const hasFooter = Boolean(footer);
  useLayoutEffect(() => {
    if (hasFooter) requestAnimationFrame(() => scrollToBottom(false));
  }, [hasFooter, scrollToBottom]);

  return (
    <div className="message-area">
      <div className="message-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Чатын мессежүүд">
        <div className="message-list-inner">
          {messages.map((m, idx) => {
            const prev = messages[idx - 1];
            const grouped = prev && !prev.system && !m.system && prev.mine === m.mine && m.ts - prev.ts < 60000;
            return (
              <Bubble
                key={m.id}
                message={m}
                original={m.replyTo ? byId.get(m.replyTo) : null}
                partnerName={partnerName}
                onReply={onReply}
                onReact={onReact}
                onUnsend={onUnsend}
                onJump={jumpTo}
                onRetry={onRetry}
                grouped={grouped}
                highlighted={flashId === m.id}
                seenLabel={seenId === m.id}
              />
            );
          })}
          {partnerTyping && <TypingBubble />}
          {footer}
        </div>
      </div>
      {newCount > 0 && (
        <button type="button" className="new-pill" onClick={() => scrollToBottom()}>
          <Icon name="arrowDown" size={16} /> {newCount} шинэ мессеж
        </button>
      )}
    </div>
  );
}

// ---------------- Бичих хэсэг ----------------
function StickerPanel({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sticker-panel" ref={ref} role="dialog" aria-label="Стикер сонгох">
      <div className="sticker-panel-head">
        <span>Стикер</span>
        <button type="button" className="icon-btn sm" aria-label="Стикер хаах" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="sticker-grid">
        {STICKERS.map((st) => (
          <button key={st.id} type="button" className="sticker-option" aria-label={`Стикер: ${st.label}`} onClick={() => onPick(st.id)}>
            <Sticker id={st.id} size={64} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({ draft, setDraft, onSend, onSendSticker, onTyping, replyTo, replyAuthor, onCancelReply, onJumpReply, inputRef, disabled, partnerOnline, cooldownMs }) {
  const [stickersOpen, setStickersOpen] = useState(false);
  const typingRef = useRef(false);
  const typingTimer = useRef(null);
  const composing = useRef(false);

  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };
  useLayoutEffect(autosize, [draft, inputRef]);

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      onTyping(false);
    }
  }, [onTyping]);

  useEffect(() => stopTyping, [stopTyping]);

  const onChange = (e) => {
    setDraft(e.target.value);
    if (e.target.value.trim()) {
      if (!typingRef.current) {
        typingRef.current = true;
        onTyping(true);
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(stopTyping, 2500);
    } else {
      stopTyping();
    }
  };

  const length = [...draft].length;
  const tooLong = length > MAX_MESSAGE_LENGTH;
  const cooling = cooldownMs > 0;
  const canSend = !disabled && draft.trim() && !tooLong && !cooling;

  const submit = () => {
    if (!canSend) return;
    stopTyping();
    // Хязгаар давсан бол бичсэнийг нь үлдээнэ
    if (onSend(draft) !== false) setDraft('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault();
      onCancelReply();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !composing.current && !e.nativeEvent.isComposing && !isCoarse()) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      {cooling && (
        <div className="rate-notice" role="alert">
          <Icon name="clock" size={16} />
          <span>
            <strong>Түр хүлээнэ үү…</strong> Хэт олон мессеж дараалан бичлээ.
          </span>
          <span className="rate-count">{Math.ceil(cooldownMs / 1000)}</span>
        </div>
      )}
      {replyTo && (
        <div className="reply-preview">
          <button type="button" className="reply-preview-body" onClick={onJumpReply} title="Эх мессеж рүү очих">
            <Icon name="reply" size={16} />
            <span className="rp-content">
              <span className="rp-label">Хариулж байна · {replyAuthor}</span>
              <span className="rp-text">{previewText(replyTo)}</span>
            </span>
          </button>
          <button type="button" className="icon-btn sm" aria-label="Хариултыг цуцлах" onClick={onCancelReply}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {stickersOpen && (
        <StickerPanel
          onClose={() => setStickersOpen(false)}
          onPick={(id) => {
            if (onSendSticker(id) !== false) setStickersOpen(false);
          }}
        />
      )}
      <form
        className={`composer ${draft.trim() ? 'has-text' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="composer-pill">
          <button
            type="button"
            className={`sticker-toggle ${stickersOpen ? 'is-active' : ''}`}
            aria-label="Стикер"
            aria-expanded={stickersOpen}
            title="Стикер"
            disabled={cooling}
            onClick={() => setStickersOpen((o) => !o)}
          >
            <Icon name="sticker" size={22} />
          </button>
          <textarea
            ref={inputRef}
            className="composer-input"
            rows={1}
            value={draft}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onBlur={stopTyping}
            onFocus={() => setStickersOpen(false)}
            placeholder={partnerOnline ? 'Мессеж бичих…' : 'Нөгөө хүн түр салсан байна…'}
            aria-label="Мессеж бичих"
            maxLength={MAX_MESSAGE_LENGTH + 200}
            disabled={disabled}
            enterKeyHint="send"
          />
          {length > MAX_MESSAGE_LENGTH - 200 && (
            <span className={`char-count ${tooLong ? 'is-over' : ''}`}>
              {length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
          {draft.trim() ? (
            <button type="submit" className="send-text-btn" disabled={!canSend} aria-label="Илгээх">
              Илгээх
            </button>
          ) : (
            <button
              type="button"
              className="quick-heart"
              aria-label="❤️ илгээх"
              title="❤️ илгээх"
              disabled={cooling || disabled}
              onClick={() => onSend('❤️')}
            >
              ❤️
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------- Мэдээлэх цонх ----------------
function ReportModal({ open, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setBusy(false);
    }
  }, [open]);
  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const ok = await onSubmit(reason);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Мэдээлэх"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn danger" disabled={!reason || busy} onClick={submit}>
            {busy ? 'Илгээж байна…' : 'Мэдээлэх'}
          </button>
        </>
      }
    >
      <fieldset className="reason-list">
        <legend>Шалтгаанаа сонгоно уу</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.id} className={`reason ${reason === r.id ? 'is-active' : ''}`}>
            <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span className="radio-dot" aria-hidden="true" />
            {r.label}
          </label>
        ))}
      </fieldset>
      <p className="hint">
        Чатын бичвэр илгээгдэхгүй — зөвхөн шалтгаан, цаг хугацаа бүртгэгдэнэ. Мэдээлсний дараа энэ хүн автоматаар
        блоклогдож, чат дуусна.
      </p>
    </Modal>
  );
}

// ---------------- Найз болох цонх ----------------
function FriendModal({ open, onClose, onSubmit, partnerOffered, last }) {
  const [platform, setPlatform] = useState(last?.platform || 'instagram');
  const [handle, setHandle] = useState(last?.handle || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);
  const meta = CONTACT_PLATFORMS.find((p) => p.id === platform);
  const valid = handle.trim().length >= 2 && handle.trim().length <= 50;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const res = await onSubmit(platform, handle.trim());
    setBusy(false);
    if (res?.ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Найз болох"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Илгээж байна…' : partnerOffered ? 'Зөвшөөрч солилцох' : 'Хүсэлт илгээх'}
          </button>
        </>
      }
    >
      <p className="muted-text">
        {partnerOffered
          ? 'Нууц нэгэн аль хэдийн хүсэлт илгээсэн байна. Та хаягаа оруулбал хоёулаа бие биеийнхээ хаягийг шууд харна.'
          : 'Хоёулаа зөвшөөрсөн үед л бие биеийнхээ хаягийг харна. Нөгөө хүн зөвшөөрөхгүй бол таны хаяг хэзээ ч харагдахгүй.'}
      </p>
      <div className="field-label small">Сошиал сүлжээ</div>
      <div className="chips platform-chips" role="radiogroup" aria-label="Сошиал сүлжээ">
        {CONTACT_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={platform === p.id}
            className={`chip ${platform === p.id ? 'is-active' : ''}`}
            onClick={() => setPlatform(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="field-label small" htmlFor="friend-handle">
        Таны {meta?.label} хаяг
      </label>
      <input
        id="friend-handle"
        className="text-input"
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={meta?.placeholder}
        maxLength={50}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        data-autofocus
      />
      <p className="hint">Утасны дугаар, гэрийн хаягаа бүү оруулаарай. Хаяг тань чат дуусахад серверээс устна.</p>
    </Modal>
  );
}

// ---------------- Чатын дэлгэц ----------------
export function Chat({ state, actions, settings, onOpenSettings }) {
  const { room, messages, partnerTyping, phase, ended, ratings, conn } = state;
  const partnerName = PARTNER_NAME;
  const cooldownMs = useCountdown(state.cooldownUntil);
  const partnerOnline = Boolean(room?.partner.online);
  const [replyTo, setReplyTo] = useState(null);
  const [draft, setDraft] = useState('');
  const [dialog, setDialog] = useState(null); // 'block' | 'leave' | 'report' | 'friend'
  const friend = state.friend || {};
  const befriended = Boolean(friend.partnerContact);
  const [suggestion, setSuggestion] = useState(null);
  const lastSuggestAt = useRef(0);
  const inputRef = useRef(null);
  const jumpRef = useRef({});
  const chatting = phase === 'chatting';

  // Өрөө солигдоход төлөвийг цэвэрлэнэ
  useEffect(() => {
    setReplyTo(null);
    setDraft('');
    setSuggestion(null);
    lastSuggestAt.current = 0;
  }, [room?.roomId]);

  useEffect(() => {
    if (!chatting) setReplyTo(null);
  }, [chatting]);

  // Мэдэгдэл дээр дарахад доош гүйлгэж, бичих хэсэг рүү
  useEffect(() => {
    const onOpen = () => {
      jumpRef.current.scrollToBottom?.(false);
      inputRef.current?.focus();
    };
    window.addEventListener('noone:open-chat', onOpen);
    return () => window.removeEventListener('noone:open-chat', onOpen);
  }, []);

  // Яриа эхлүүлэх санааг хааяа санал болгоно
  const userMessageCount = messages.filter((m) => !m.system).length;
  useEffect(() => {
    setSuggestion(null);
  }, [userMessageCount]);
  useEffect(() => {
    if (!settings.icebreakers || !chatting || !room) {
      setSuggestion(null);
      return undefined;
    }
    const tick = () => {
      const now = Date.now();
      if (draft.trim()) return;
      const real = messages.filter((m) => !m.system);
      const lastTs = real.length ? real[real.length - 1].ts : room.startedAt;
      const quiet = now - lastTs;
      const due = real.length === 0 ? quiet > 1200 : quiet > 30000;
      if (due && now - lastSuggestAt.current > 90000) {
        lastSuggestAt.current = now;
        setSuggestion(pickIcebreaker(room.sharedInterests));
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.icebreakers, chatting, room, messages, draft]);

  const startReply = useCallback((m) => {
    setReplyTo(m);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const send = (text) => {
    if (!actions.takeSendToken()) return false;
    actions.sendMessage(text, replyTo?.id || null);
    setReplyTo(null);
    setSuggestion(null);
    return true;
  };

  const sendSticker = (id) => {
    if (!actions.takeSendToken()) return false;
    actions.sendMessage('', replyTo?.id || null, id);
    setReplyTo(null);
    setSuggestion(null);
    return true;
  };

  let statusText = 'Онлайн';
  let statusClass = 'is-online';
  if (!chatting) {
    statusText = 'Чат дууссан';
    statusClass = 'is-ended';
  } else if (conn !== 'online') {
    statusText = 'Таны холболт тасарсан';
    statusClass = 'is-away';
  } else if (!partnerOnline) {
    statusText = 'Салсан, хүлээж байна…';
    statusClass = 'is-away';
  } else if (partnerTyping) {
    statusText = 'Бичиж байна…';
    statusClass = 'is-typing';
  }

  const endedPartnerSide = ended && ['partner_left', 'partner_disconnected', 'you_left', 'connection_lost'].includes(ended.reason);

  const endPanel = !chatting && ended && (
    <div className="end-card" role="status">
      <div className="end-title">Чат дууслаа</div>
      <p className="end-reason">{ENDED_TEXT[ended.reason] || 'Чат дууслаа.'}</p>
      {ended.roomId && (
        <RatingCard roomId={ended.roomId} rating={ratings[ended.roomId]} onRate={actions.rate} />
      )}
      <div className="end-actions">
        <button type="button" className="btn primary" onClick={actions.next}>
          <Icon name="next" size={18} /> Дараагийн хүн хайх
        </button>
        <button type="button" className="btn ghost" onClick={actions.goHome}>
          <Icon name="home" size={18} /> Нүүр хуудас
        </button>
      </div>
      {endedPartnerSide && (
        <div className="end-links">
          <button type="button" className="link-btn" onClick={() => setDialog('report')}>
            <Icon name="flag" size={14} /> Мэдээлэх
          </button>
          <button type="button" className="link-btn" onClick={() => setDialog('block')}>
            <Icon name="block" size={14} /> Блоклох
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="screen chat">
      <header className="chat-head">
        <div className="peer">
          <Avatar />
          <div className="peer-info">
            <div className="peer-name">{partnerName}</div>
            <div className={`peer-status ${statusClass}`}>
              <span className="dot" aria-hidden="true" />
              {statusText}
            </div>
          </div>
        </div>
        <div className="head-actions">
          {chatting && (
            <button
              type="button"
              className={`icon-btn friend-btn ${befriended ? 'is-done' : friend.mine ? 'is-pending' : ''} ${friend.partnerOffered && !befriended ? 'has-request' : ''}`}
              aria-label={befriended ? 'Найз боллоо' : 'Найз болох'}
              title={befriended ? 'Найз боллоо' : friend.mine ? 'Хүсэлт илгээсэн' : 'Найз болох'}
              onClick={() => !befriended && !friend.mine && setDialog('friend')}
            >
              <Icon name={befriended ? 'heartHand' : 'userPlus'} size={20} />
            </button>
          )}
          {chatting && (
            <button type="button" className="btn next-btn" onClick={actions.next} aria-label="Дараагийн хүн" title="Дараагийн хүн">
              <Icon name="next" size={18} />
              <span className="lbl-long">Дараагийн хүн</span>
              <span className="lbl-short">Дараах</span>
            </button>
          )}
          <Menu
            items={[
              { label: 'Найз болох', icon: 'userPlus', onClick: () => setDialog('friend'), hidden: !chatting || befriended || Boolean(friend.mine) },
              { label: 'Мэдээлэх', icon: 'flag', onClick: () => setDialog('report'), hidden: !chatting && !endedPartnerSide },
              { label: 'Блоклох', icon: 'block', onClick: () => setDialog('block'), danger: true, hidden: !chatting && !endedPartnerSide },
              { label: 'Чат дуусгах', icon: 'logout', onClick: () => setDialog('leave'), hidden: !chatting },
              { label: 'Нүүр хуудас', icon: 'home', onClick: actions.goHome, hidden: chatting },
              { label: 'Өнгө солих', icon: 'palette', onClick: onOpenSettings },
              { label: 'Тохиргоо', icon: 'settings', onClick: onOpenSettings },
            ]}
          />
        </div>
      </header>

      {(room?.sharedInterests?.length > 0 || room?.sharedSchool) && (
        <div className="shared-bar">
          {room.sharedSchool && (
            <>
              Нэг сургууль:
              <span className="mini-chip school-chip">{schoolLabel(room.sharedSchool)}</span>
            </>
          )}
          {room.sharedInterests?.length > 0 && (
            <>
              Ижил сонирхол:
              {room.sharedInterests.map((i) => (
                <span key={i} className="mini-chip">
                  {interestLabel(i)}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <MessageList
        messages={messages}
        partnerTyping={partnerTyping && chatting}
        partnerName={partnerName}
        onReply={chatting ? startReply : null}
        onReact={chatting ? actions.react : null}
        onUnsend={chatting ? actions.unsend : null}
        onRetry={actions.retryMessage}
        jumpRef={jumpRef}
        footer={endPanel}
      />

      {chatting && (
        <div className="chat-bottom">
          {!befriended && friend.mine && (
            <div className="friend-bar is-waiting">
              <Icon name="clock" size={16} />
              <span>Найз болох хүсэлт илгээсэн. Нууц нэгэн зөвшөөрөхийг хүлээж байна…</span>
              <button type="button" className="link-btn" onClick={actions.cancelFriend}>
                Цуцлах
              </button>
            </div>
          )}
          {!befriended && !friend.mine && friend.partnerOffered && (
            <div className="friend-bar is-request">
              <Icon name="heartHand" size={16} />
              <span>Нууц нэгэн тантай найз болохыг хүсч байна!</span>
              <button type="button" className="btn sm primary" onClick={() => setDialog('friend')}>
                Найз болох
              </button>
            </div>
          )}
          {suggestion && !replyTo && !(friend.partnerOffered && !befriended && !friend.mine) && (
            <div className="suggestion">
              <Icon name="sparkle" size={16} />
              <button
                type="button"
                className="suggestion-text"
                onClick={() => {
                  setDraft(suggestion);
                  setSuggestion(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                title="Бичих хэсэгт оруулах"
              >
                {suggestion}
              </button>
              <button
                type="button"
                className="icon-btn sm"
                aria-label="Өөр санаа"
                onClick={() => setSuggestion((s) => pickIcebreaker(room.sharedInterests, s))}
              >
                <Icon name="refresh" size={16} />
              </button>
              <button type="button" className="icon-btn sm" aria-label="Санааг хаах" onClick={() => setSuggestion(null)}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <Composer
            draft={draft}
            setDraft={setDraft}
            onSend={send}
            onSendSticker={sendSticker}
            onTyping={actions.setTyping}
            replyTo={replyTo}
            replyAuthor={replyTo?.mine ? 'Өөрийн мессеж' : partnerName}
            onCancelReply={() => setReplyTo(null)}
            onJumpReply={() => replyTo && jumpRef.current.jumpTo?.(replyTo.id)}
            inputRef={inputRef}
            disabled={false}
            partnerOnline={partnerOnline}
            cooldownMs={cooldownMs}
          />
        </div>
      )}

      <FriendModal
        open={dialog === 'friend'}
        onClose={() => setDialog(null)}
        onSubmit={actions.offerFriend}
        partnerOffered={friend.partnerOffered}
        last={friend.mine}
      />
      <ConfirmDialog
        open={dialog === 'block'}
        title="Блоклох уу?"
        body="Чат дуусч, энэ хүнтэй дахин холбогдохгүй. Нөгөө хүнд блоклосныг мэдэгдэхгүй."
        confirmLabel="Блоклох"
        onConfirm={actions.block}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'leave'}
        title="Чатыг дуусгах уу?"
        body="Чат дуусч, бүх мессеж арилна. Дараа нь шинэ хүн хайх боломжтой."
        confirmLabel="Дуусгах"
        tone="primary"
        onConfirm={actions.leave}
        onClose={() => setDialog(null)}
      />
      <ReportModal open={dialog === 'report'} onClose={() => setDialog(null)} onSubmit={actions.report} />
    </div>
  );
}
