import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export default function CursorEffects() {
  const cursorRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const trailRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const trail = trailRef.current;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!cursor || !dot || !ring || !trail || !finePointer.matches || reducedMotion.matches) {
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    import("gsap").then(({ gsap }) => {
      if (disposed) return;

      document.documentElement.classList.add("has-arena-cursor");
      gsap.set([dot, ring, trail], { x: -100, y: -100 });

      const moveDotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
      const moveDotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
      const moveRingX = gsap.quickTo(ring, "x", { duration: 0.24, ease: "power3.out" });
      const moveRingY = gsap.quickTo(ring, "y", { duration: 0.24, ease: "power3.out" });
      const moveTrailX = gsap.quickTo(trail, "x", { duration: 0.42, ease: "power2.out" });
      const moveTrailY = gsap.quickTo(trail, "y", { duration: 0.42, ease: "power2.out" });

      let activeMagnet = null;

      const handlePointerMove = (event) => {
        if (event.pointerType === "touch") return;
        const target = event.target instanceof Element ? event.target : null;
        const textField = target?.closest("input, textarea, select, [contenteditable='true']");
        cursor.dataset.visible = textField ? "false" : "true";

        moveDotX(event.clientX);
        moveDotY(event.clientY);
        moveRingX(event.clientX);
        moveRingY(event.clientY);
        moveTrailX(event.clientX);
        moveTrailY(event.clientY);

        const magnet = target?.closest("[data-magnetic]");
        if (magnet) {
          activeMagnet = magnet;
          const bounds = magnet.getBoundingClientRect();
          const x = event.clientX - bounds.left - bounds.width / 2;
          const y = event.clientY - bounds.top - bounds.height / 2;
          gsap.to(magnet, {
            x: x * 0.12,
            y: y * 0.18,
            duration: 0.28,
            ease: "power3.out",
            overwrite: "auto",
          });
        } else if (activeMagnet) {
          gsap.to(activeMagnet, {
            x: 0,
            y: 0,
            duration: 0.45,
            ease: "elastic.out(1, 0.45)",
            overwrite: "auto",
          });
          activeMagnet = null;
        }
      };

      const handlePointerOver = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const textField = target.closest("input, textarea, select, [contenteditable='true']");
        if (textField) {
          cursor.dataset.visible = "false";
          cursor.dataset.hover = "text";
          return;
        }
        const card = target.closest("[data-cursor='card']");
        const control = target.closest("a, button, [role='button'], [role='tab']");
        cursor.dataset.hover = card ? "card" : control ? "control" : "default";

        const section = target.closest("[data-cursor-section]");
        if (section) {
          cursor.dataset.section = section.dataset.cursorSection;
        }
      };

      const handlePointerOut = (event) => {
        if (!event.relatedTarget) {
          cursor.dataset.visible = "false";
        }
      };

      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerover", handlePointerOver, { passive: true });
      window.addEventListener("pointerout", handlePointerOut, { passive: true });

      cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerover", handlePointerOver);
        window.removeEventListener("pointerout", handlePointerOut);
        if (activeMagnet) {
          gsap.killTweensOf(activeMagnet);
          gsap.set(activeMagnet, { clearProps: "transform" });
        }
        gsap.killTweensOf([dot, ring, trail]);
        document.documentElement.classList.remove("has-arena-cursor");
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.dataset.section = location.pathname.startsWith("/u/") ? "hero" : "hero";
    }
  }, [location.pathname]);

  return (
    <div
      ref={cursorRef}
      className="arena-cursor"
      data-section="hero"
      data-hover="default"
      data-visible="false"
      aria-hidden="true"
    >
      <span ref={trailRef} className="arena-cursor__trail" />
      <span ref={ringRef} className="arena-cursor__ring" />
      <span ref={dotRef} className="arena-cursor__dot" />
      <span className="arena-cursor__crosshair" />
    </div>
  );
}
