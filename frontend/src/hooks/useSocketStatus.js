import { useEffect, useState } from "react";
import { getSocket } from "../config/socket";

// Tracks the shared socket's connection state so the Header can show a real "Live"/"Connecting"
// indicator instead of static text.
export function useSocketStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  return connected;
}
