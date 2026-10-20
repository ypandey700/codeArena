import { useEffect, useRef } from "react";

export default function CursorEffects() {
  const cursorRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const trailRef = useRef(null);

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

      document.documentElement.classList.add("has-Code -cursor");
      gsap.set([dot, ring, trail], { x: -100, y: -100 });

      const moveDotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
      const moveDotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
      const moveRingX = gsap.quickTo(ring, "x", { duration: 0.24, ease: "power3.out" });
      const moveRingY = gsap.quickTo(ring, "y", { duration: 0.24, ease: "power3.out" });
      const moveTrailX = gsap.quickTo(trail, "x", { duration: 0.42, ease: "power2.out" });
      const moveTrailY = gsap.quickTo(trail, "y", { duration: 0.42, ease: "power2.out" });

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
      };

      const handlePointerOut = (event) => {
        if (!event.relatedTarget) cursor.dataset.visible = "false";
      };

      const magnets = Array.from(document.querySelectorAll("[data-magnetic]"));
      const magnetCleanups = magnets.map((element) => {
        const handleMagneticMove = (event) => {
          const bounds = element.getBoundingClientRect();
          const x = event.clientX - bounds.left - bounds.width / 2;
          const y = event.clientY - bounds.top - bounds.height / 2;
          gsap.to(element, { x: x * 0.12, y: y * 0.18, duration: 0.28, ease: "power3.out", overwrite: "auto" });
        };
        const resetMagnetic = () =>
          gsap.to(element, { x: 0, y: 0, duration: 0.45, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
        element.addEventListener("pointermove", handleMagneticMove);
        element.addEventListener("pointerleave", resetMagnetic);
        return () => {
          element.removeEventListener("pointermove", handleMagneticMove);
          element.removeEventListener("pointerleave", resetMagnetic);
          gsap.killTweensOf(element);
          gsap.set(element, { clearProps: "transform" });
        };
      });

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerover", handlePointerOver);
      window.addEventListener("pointerout", handlePointerOut);

      cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerover", handlePointerOver);
        window.removeEventListener("pointerout", handlePointerOut);
        magnetCleanups.forEach((remove) => remove());
        gsap.killTweensOf([dot, ring, trail]);
        document.documentElement.classList.remove("has-Code -cursor");
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="Code -cursor"
      data-section="hero"
      data-hover="default"
      data-visible="false"
      aria-hidden="true"
    >
      <span ref={trailRef} className="Code -cursor__trail" />
      <span ref={ringRef} className="Code -cursor__ring" />
      <span ref={dotRef} className="Code -cursor__dot" />
      <span className="Code -cursor__crosshair" />
    </div>
  );
}
