import { createContext, useContext, useEffect, useState } from "react";
import api, { onAuthFailure, setAccessToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState(null);

  const openLogin = () => setAuthModal("login");
  const openSignup = () => setAuthModal("signup");
  const closeAuthModal = () => setAuthModal(null);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const refreshRes = await api.post("/auth/refresh");
        const token = refreshRes.data?.data?.accessToken;
        if (token) {
          setAccessToken(token);
          const meRes = await api.get("/auth/me");
          if (mounted) {
            setUser(meRes.data?.data?.user || null);
          }
        }
      } catch {
        if (mounted) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    onAuthFailure(() => {
      if (mounted) {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post("/auth/login", { identifier, password });
    const { user: userData, accessToken: token } = res.data.data;
    setAccessToken(token);
    setUser(userData);
    return userData;
  };

  const register = async (username, email, password) => {
    const res = await api.post("/auth/register", { username, email, password });
    const { user: userData, accessToken: token } = res.data.data;
    setAccessToken(token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      const updated = res.data?.data?.user;
      setUser(updated);
      return updated;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authModal,
        openLogin,
        openSignup,
        closeAuthModal,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {loading ? (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0b100f]">
          <div className="relative flex items-center justify-center">
            <span className="h-8 w-8 animate-ping rounded-full bg-lime-300/30" />
            <span className="absolute h-3 w-3 rounded-full bg-lime-300 shadow-[0_0_12px_#bef264]" />
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
