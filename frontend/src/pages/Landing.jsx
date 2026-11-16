import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Keep the original Tailwind 3 page isolated from the app's Tailwind 4 styles.
export default function Landing() {
  const { user, openLogin, openSignup } = useAuth();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  function connectActions() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", (event) => {
      const control = event.target.closest?.("a, button");
      if (!control) return;
      const label = control.textContent.trim().replace(/\s+/g, " ");
      if (/^sign in$/i.test(label)) {
        event.preventDefault();
        openLogin();
      } else if (/find 1v1|enter arena free|github auth|^google$/i.test(label)) {
        event.preventDefault();
        if (user) navigate("/battle-modes");
        else openSignup();
      }
    });
  }

  return (
    <iframe
      ref={frameRef}
      src="/landing-reference.html"
      title="Code Arena - competitive coding arena"
      onLoad={connectActions}
      className="block h-dvh w-full border-0 bg-[#07090d]"
    />
  );
}
