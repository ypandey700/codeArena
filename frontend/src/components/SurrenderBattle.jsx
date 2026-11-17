import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, Flag, LoaderCircle, X } from "lucide-react";
import { useBattle } from "../context/BattleContext";
import "./SurrenderBattle.css";

function SurrenderDialog({ loss, pending, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const triggerRef = useRef(document.activeElement);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="surrender-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
      <header><h2 id={titleId}>Surrender and exit this duel?</h2><button type="button" aria-label="Close surrender warning" disabled={pending} onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
      <div className="surrender-dialog__body" id={descriptionId}>
        <span className="surrender-dialog__warning"><CircleAlert size={22} aria-hidden="true" /><strong>{Number.isFinite(loss) ? `${loss > 0 ? "−" : ""}${loss} rating points` : "Your rating will decrease"}</strong></span>
        <p>Surrendering counts as a loss and awards your opponent the win. It ends coding and the interview immediately and takes you to the match result.</p>
        <p>This cannot be undone. Match time continues while this warning is open.</p>
      </div>
      {error && <p className="surrender-dialog__error" role="alert">{error}</p>}
      <footer><button ref={cancelRef} type="button" disabled={pending} onClick={onClose}>Stay in duel</button><button type="button" className="surrender-dialog__confirm" disabled={pending} onClick={onConfirm}>{pending ? <LoaderCircle size={14} className="surrender-spin" aria-hidden="true" /> : <Flag size={14} aria-hidden="true" />}{pending ? "Surrendering…" : "Surrender & exit"}</button></footer>
    </dialog>, document.body,
  );
}

export default function SurrenderBattle({ onOpen }) {
  const { activeBattle, forfeitBattle, forfeitPending } = useBattle();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const confirmingRef = useRef(false);
  const mountedRef = useRef(false);
  const available = activeBattle?.status === "active";

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { setOpen(false); setError(""); }, [activeBattle?.battleId, available]);

  async function confirm() {
    if (confirmingRef.current || forfeitPending) return;
    confirmingRef.current = true;
    setError("");
    try {
      await forfeitBattle();
      if (mountedRef.current) setOpen(false);
    } catch (failure) {
      if (mountedRef.current) setError(failure.message);
    } finally { confirmingRef.current = false; }
  }

  return <>
    <button type="button" className="surrender-button" disabled={!available || forfeitPending} aria-haspopup="dialog" onClick={() => { setError(""); onOpen?.(); setOpen(true); }}><Flag size={14} aria-hidden="true" />Surrender</button>
    {open && available && <SurrenderDialog loss={activeBattle.forfeitRatingLoss} pending={forfeitPending} error={error} onClose={() => { if (!forfeitPending) setOpen(false); }} onConfirm={confirm} />}
  </>;
}
