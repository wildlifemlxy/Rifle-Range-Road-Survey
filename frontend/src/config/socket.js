import { io } from "socket.io-client";

// The frontend dev server proxies /api to the backend but that proxy doesn't handle the
// WebSocket upgrade, so the socket connects directly to the backend's own origin. In production
// (Azure Static Web Apps) there's no proxy at all, so it must always point at the deployed backend.
const SOCKET_URL = window.location.hostname.includes("localhost")
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : "https://rrr-backend-dehee0etbwefffbv.southeastasia-01.azurewebsites.net";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: true });
  }
  return socket;
};
