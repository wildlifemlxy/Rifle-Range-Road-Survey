import { io } from "socket.io-client";

// The frontend dev server proxies /api to the backend but that proxy doesn't handle the
// WebSocket upgrade, so the socket connects directly to the backend's own origin.
const SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:3001`;

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true });
  }
  return socket;
};
