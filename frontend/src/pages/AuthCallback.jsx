import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Code2, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const formatError = (code) => {
  if (!code) return "Authentication failed";
  const messages = {
    invalid_state: "Security verification failed (invalid OAuth state). Please try again.",
    email_not_verified: "Your email address is not verified by the OAuth provider. A verified email is required.",
    google_not_configured: "Google sign-in is not configured on the server.",
    github_not_configured: "GitHub sign-in is not configured on the server.",
    access_denied: "Sign in was cancelled or permission was denied.",
    server_error: "A server error occurred during authentication. Please try again.",
    auth_failed: "Failed to authenticate with provider.",
  };
  return messages[code] || decodeURIComponent(code);
};

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth, openLogin } = useAuth();
  const errorCode = searchParams.get("error");
  const [errorMsg, setErrorMsg] = useState(errorCode ? formatError(errorCode) : "");
  const [loading, setLoading] = useState(!errorCode);

  useEffect(() => {
    if (errorCode) {
      setLoading(false);
      return;
    }

    let active = true;

    refreshAuth()
      .then(() => {
        if (active) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((err) => {
        if (active) {
          const message =
            err.response?.data?.message || err.message || "Failed to finalize session";
          setErrorMsg(formatError(message));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [errorCode, refreshAuth, navigate]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-[#293449] bg-[#10141d] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-[#e4eaf5]">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#e4eaf5] text-[#080c13]">
            <Code2 size={17} />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            codearena<span className="text-[#fddf49]">.</span>
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-5 flex items-center justify-center">
              <span className="h-8 w-8 animate-ping rounded-full bg-primary/30" />
              <span className="absolute h-3 w-3 rounded-full bg-primary shadow-[0_0_12px_#c5a17a]" />
            </div>
            <p className="text-sm font-semibold tracking-tight text-on-surface">Entering the arena…</p>
            <p className="mt-1 text-xs text-on-surface-subtle">Finalizing authentication with Code Arena</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#efa4ad]">
              <AlertCircle size={18} />
              <h2 className="text-sm font-semibold tracking-tight">Authentication Error</h2>
            </div>
            <div
              role="alert"
              className="rounded-md border border-[#79464d] bg-[#40272c]/50 px-3.5 py-3 text-xs leading-5 text-[#efa4ad]"
            >
              {errorMsg}
            </div>
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  openLogin();
                  navigate("/");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#fddf49] py-2.5 text-[13px] font-semibold text-[#24200b] transition hover:bg-[#ffe76e]"
              >
                <RefreshCw size={15} />
                Try again
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-[#2c3850] bg-[#080c13] py-2.5 text-[13px] font-medium text-on-surface-muted transition hover:border-[#ffe76e] hover:text-on-surface"
              >
                <ArrowLeft size={15} />
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
