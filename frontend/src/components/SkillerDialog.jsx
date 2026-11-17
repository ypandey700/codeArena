import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function SkillerDialog({ title, onClose, busy = false, children }) {
  const ref = useRef(null), trigger = useRef(document.activeElement);
  useEffect(() => {
    const dialog = ref.current, overflow = document.body.style.overflow, lockHere = overflow !== 'hidden';
    if (lockHere) document.body.style.overflow = 'hidden';
    dialog.showModal(); dialog.focus({ preventScroll: true });
    return () => { dialog.close(); if (lockHere) document.body.style.overflow = overflow; if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} tabIndex={-1} className="sk-dialog" aria-labelledby="sk-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => {
    if (busy || event.target !== event.currentTarget) return;
    const box = ref.current.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')).filter((element) => element.getClientRects().length), first = controls[0], last = controls.at(-1);
    if (document.activeElement === ref.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><header><h2 id="sk-dialog-title">{title}</h2><button type="button" className="sk-icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} aria-hidden="true" /></button></header>{children}</dialog>, document.body);
}
