import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "")
    : "http://localhost:5000");

let socket = null;

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
