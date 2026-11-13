import { useRef } from "react";
import { useAuth } from "../context/AuthContext";

// Isolate the supplied Tailwind 3 design from the application's Tailwind 4
// utilities so its sizing, resets, and custom styles render unchanged.
export default function Landing() {
  const { user, openLogin, openSignup } = useAuth();
  const frameRef = useRef(null);

  function connectActions() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", (event) => {
      const control = event.target.closest("a, button");
      if (!control) return;
      const label = control.textContent.trim().replace(/\s+/g, " ");
      if (/^sign in$/i.test(label)) {
        event.preventDefault();
        openLogin();
      } else if (/find 1v1|enter arena free|github auth|^google$/i.test(label)) {
        event.preventDefault();
        if (user) window.location.assign("/battle-modes");
        else openSignup();
      }
    });
  }

  return <iframe ref={frameRef} src="/landing-reference.html" title="Code Arena - competitive coding arena" onLoad={connectActions} className="block h-dvh w-full border-0 bg-[#07090d]" />;
}
