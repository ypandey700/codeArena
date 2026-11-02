import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading, openLogin } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      openLogin();
    }
  }, [loading, user, openLogin]);

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
