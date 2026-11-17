import { useRef } from "react";
import { GripHorizontal, GripVertical } from "lucide-react";

export default function ArenaResizeHandle({ axis, value, onChange, containerRef, label, controls, min, max, initial }) {
  const dragRef = useRef(null);
  const vertical = axis === "x";
  const clamp = (next) => Math.max(min, Math.min(max, next));
  const stop = (event) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div className={`ba-resize-handle ba-resize-handle--${axis}`} role="separator" tabIndex={0}
      aria-label={label} aria-orientation={vertical ? "vertical" : "horizontal"} aria-controls={controls}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} percent`}
      title={`${label}. Drag or use arrow keys. Double-click to reset.`}
      onDoubleClick={() => onChange(initial)}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { id: event.pointerId, bounds };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const next = vertical ? (event.clientX - drag.bounds.left) / drag.bounds.width : (event.clientY - drag.bounds.top) / drag.bounds.height;
        onChange(clamp(next * 100));
      }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { dragRef.current = null; }}
      onKeyDown={(event) => {
        const decrease = vertical ? "ArrowLeft" : "ArrowUp";
        const increase = vertical ? "ArrowRight" : "ArrowDown";
        if (![decrease, increase, "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        onChange(event.key === "Home" ? min : event.key === "End" ? max : clamp(value + (event.key === increase ? step : -step)));
      }}>
      {vertical ? <GripVertical size={13} aria-hidden="true" /> : <GripHorizontal size={16} aria-hidden="true" />}
    </div>
  );
}
