import { io } from "socket.io-client";
import axios from "axios";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "")
    : "http://localhost:5000");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

let socket = null;
let isRefreshing = false;

export const getSocket = () => socket;

export const connectSocket = (token) => {
  if (!token) return null;
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }
  socket = io(SERVER_URL, {
    auth: { token },
    withCredentials: true,
    autoConnect: true,
  });

  socket.on("connect_error", async (err) => {
    const msg = err?.message?.toLowerCase() || "";
    if (msg.includes("authentication error") || msg.includes("invalid token") || msg.includes("token required")) {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = res.data?.data?.accessToken;
        if (newToken && socket) {
          socket.auth = { token: newToken };
          socket.connect();
        }
      } catch {
        disconnectSocket();
      } finally {
        isRefreshing = false;
      }
    }
  });

  return socket;
};

export const updateSocketToken = (token) => {
  if (!token) {
    disconnectSocket();
    return;
  }
  if (!socket) {
    connectSocket(token);
    return;
  }
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
