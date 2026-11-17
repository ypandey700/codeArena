import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ChevronRight, GripHorizontal, MessageSquare, Minimize2, Send } from "lucide-react";
import { ArenaAvatar } from "./ArenaPlayerCard";

const time = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function ArenaChat({ open, onOpen, onMinimize, messages, sendMessage, user, opponent, unread, onViewPlayer }) {
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState(null);
  const [position, setPosition] = useState(null);
  const [newMessages, setNewMessages] = useState(false);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const streamRef = useRef(null);
  const atBottomRef = useRef(true);
  const previousOpenRef = useRef(false);
  const previousCountRef = useRef(messages.length);
  const dragRef = useRef(null);

  const scrollToLatest = () => {
    const stream = streamRef.current;
    if (stream) stream.scrollTop = stream.scrollHeight;
    atBottomRef.current = true;
    setNewMessages(false);
  };
  useEffect(() => {
    if (open) {
      if (!previousOpenRef.current || atBottomRef.current) scrollToLatest();
      else if (messages.length > previousCountRef.current) setNewMessages(true);
      if (!previousOpenRef.current) inputRef.current?.focus({ preventScroll: true });
    } else if (previousOpenRef.current) launcherRef.current?.focus({ preventScroll: true });
    previousOpenRef.current = open;
    previousCountRef.current = messages.length;
  }, [open, messages]);

  useLayoutEffect(() => {
    const keepOnScreen = () => {
      const box = panelRef.current?.getBoundingClientRect();
      if (!box) return;
      setPosition((previous) => previous ? { x: Math.max(8, Math.min(previous.x, window.innerWidth - box.width - 8)), y: Math.max(8, Math.min(previous.y, window.innerHeight - box.height - 8)) } : null);
    };
    keepOnScreen();
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, [open]);

  const send = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setSendError(null);
    sendMessage(text, (message) => setSendError({ message, text }));
    setInput("");
    atBottomRef.current = true;
  };

  if (!open) return <button ref={launcherRef} type="button" className="ba-chat-launcher" onClick={onOpen} aria-expanded="false" aria-controls="ba-floating-chat"><span className="ba-chat-launcher__icon"><MessageSquare size={19} aria-hidden="true" /></span><span><strong>Match chat</strong><small>{unread ? `${unread} unread ${unread === 1 ? "message" : "messages"}` : "Say hello to your rival"}</small></span>{unread > 0 && <b>{unread}</b>}</button>;

  return (
    <aside ref={panelRef} id="ba-floating-chat" className={`ba-floating-chat${position ? " is-positioned" : ""}`} data-arena-chat role="region" aria-labelledby="ba-chat-heading" style={position ? { left: position.x, top: position.y } : undefined} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onMinimize(); } }}>
      <header className="ba-floating-chat__header" onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || event.target.closest("button")) return;
        const box = panelRef.current.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { id: event.pointerId, x: event.clientX - box.left, y: event.clientY - box.top };
      }} onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const box = panelRef.current.getBoundingClientRect();
        setPosition({ x: Math.max(8, Math.min(event.clientX - drag.x, window.innerWidth - box.width - 8)), y: Math.max(8, Math.min(event.clientY - drag.y, window.innerHeight - box.height - 8)) });
      }} onPointerUp={(event) => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { dragRef.current = null; }} onLostPointerCapture={() => { dragRef.current = null; }}>
        <span className="ba-floating-chat__title"><MessageSquare size={15} aria-hidden="true" /><strong id="ba-chat-heading">Match chat</strong><span>Live</span></span><GripHorizontal size={16} className="ba-chat-drag" aria-hidden="true" /><button type="button" className="ba-icon-button" onClick={onMinimize} aria-label="Minimize match chat"><Minimize2 size={16} aria-hidden="true" /></button>
      </header>
      <button type="button" className="ba-chat-rival" onClick={onViewPlayer} aria-label={`View ${opponent?.username || "opponent"}'s player card`}><ArenaAvatar player={opponent} /><span><strong>{opponent?.username || "Your opponent"}</strong><small>{opponent?.college || "View player card & achievements"}</small></span><ChevronRight size={13} className="ba-chat-rival__mark" aria-hidden="true" /></button>
      <div ref={streamRef} className="ba-chat-stream" role="log" aria-label="Match messages" aria-live="polite" aria-relevant="additions" onScroll={(event) => {
        const stream = event.currentTarget;
        atBottomRef.current = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 35;
        if (atBottomRef.current) setNewMessages(false);
      }}>
        {messages.length ? messages.map((message, index) => {
          const own = message.from === user?.username || message.from === "You";
          const timestamp = message.at ? time(message.at) : "";
          return <article key={index} className={`ba-chat-message${message.isSystem ? " is-system" : own ? " is-own" : ""}`}><div className="ba-chat-message__meta"><strong>{message.isSystem ? "Match notice" : own ? "You" : message.from || opponent?.username || "Opponent"}</strong>{timestamp && <time dateTime={new Date(message.at).toISOString()}>{timestamp}</time>}</div><p>{message.text}</p></article>;
        }) : <div className="ba-chat-empty"><MessageSquare size={27} aria-hidden="true" /><strong>A good duel starts with a hello.</strong><p>Send {opponent?.username || "your rival"} a message.<br />Keep it friendly. Keep coding.</p></div>}
      </div>
      {newMessages && <button type="button" className="ba-chat-latest" onClick={scrollToLatest}><ArrowDown size={12} aria-hidden="true" />New messages</button>}
      <div className="ba-chat-replies" aria-label="Quick message suggestions">{["Good luck!", "Nice work!", "Well played!"].map((text) => <button type="button" key={text} onClick={() => { setInput(text); inputRef.current?.focus({ preventScroll: true }); }}>{text}</button>)}</div>
      {sendError && <p className="ba-chat-send-error" role="alert">{sendError.message}<button type="button" onClick={() => { setInput(sendError.text); setSendError(null); inputRef.current?.focus(); }}>Restore message</button></p>}
      <form className="ba-chat-form" onSubmit={send}><label className="ba-sr-only" htmlFor="ba-chat-input">Message your opponent</label><input ref={inputRef} id="ba-chat-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={200} placeholder="Write a message…" autoComplete="off" /><button type="submit" className="ba-button ba-button--primary" disabled={!input.trim()} aria-label="Send message"><Send size={16} aria-hidden="true" /></button></form>
      <div className="ba-chat-hint"><span>Enter to send · Esc to minimize</span><span>{input.length}/200</span></div>
    </aside>
  );
}
