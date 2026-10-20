import { useEffect } from "react";

export default function ScrollEffects() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    let disposed = false;
    let cleanup = () => {};

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;

      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        gsap.utils.toArray("[data-reveal]").forEach((element) => {
          gsap.fromTo(
            element,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: "power3.out",
              immediateRender: false,
              scrollTrigger: { trigger: element, start: "top 88%", toggleActions: "play none none reverse" },
            },
          );
        });

        gsap.utils.toArray("[data-reveal-stagger]").forEach((group) => {
          const items = Array.from(group.children);
          gsap.fromTo(
            items,
            { autoAlpha: 0, y: 22, rotateX: 4 },
            {
              autoAlpha: 1,
              y: 0,
              rotateX: 0,
              duration: 0.6,
              stagger: 0.09,
              ease: "power3.out",
              immediateRender: false,
              scrollTrigger: { trigger: group, start: "top 86%", toggleActions: "play none none reverse" },
            },
          );
        });

        gsap.to(".arena-glow", {
          y: 42,
          ease: "none",
          scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: 1 },
        });

        gsap.to(".arena-perspective", {
          y: -28,
          ease: "none",
          scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: 1 },
        });

        const cursor = document.querySelector(".Code -cursor");
        gsap.utils.toArray("[data-cursor-section]").forEach((section) => {
          ScrollTrigger.create({
            trigger: section,
            start: "top center",
            end: "bottom center",
            onEnter: () => {
              if (cursor) cursor.dataset.section = section.dataset.cursorSection ?? "hero";
            },
            onEnterBack: () => {
              if (cursor) cursor.dataset.section = section.dataset.cursorSection ?? "hero";
            },
          });
        });
      });

      const tiltCleanups = Array.from(document.querySelectorAll("[data-tilt]")).map((element) => {
        const restingRotationX = Number(gsap.getProperty(element, "rotationX")) || 0;
        const restingRotationY = Number(gsap.getProperty(element, "rotationY")) || 0;
        const handlePointerMove = (event) => {
          if (event.pointerType === "touch") return;
          const bounds = element.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - 0.5;
          const y = (event.clientY - bounds.top) / bounds.height - 0.5;
          gsap.to(element, {
            rotationY: restingRotationY + x * 7,
            rotationX: restingRotationX + y * -6,
            transformPerspective: 700,
            duration: 0.35,
            ease: "power2.out",
            overwrite: "auto",
          });
        };
        const resetTilt = () =>
          gsap.to(element, {
            rotationX: restingRotationX,
            rotationY: restingRotationY,
            duration: 0.5,
            ease: "power3.out",
            overwrite: "auto",
          });
        element.addEventListener("pointermove", handlePointerMove);
        element.addEventListener("pointerleave", resetTilt);
        return () => {
          element.removeEventListener("pointermove", handlePointerMove);
          element.removeEventListener("pointerleave", resetTilt);
          gsap.killTweensOf(element);
          gsap.set(element, { clearProps: "transform,perspective" });
        };
      });

      ScrollTrigger.refresh();

      cleanup = () => {
        tiltCleanups.forEach((remove) => remove());
        context.revert();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return null;
}
