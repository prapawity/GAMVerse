import { useEffect, useState } from "react";

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const setOnlineState = () => setOnline(navigator.onLine);
    window.addEventListener("online", setOnlineState);
    window.addEventListener("offline", setOnlineState);
    return () => {
      window.removeEventListener("online", setOnlineState);
      window.removeEventListener("offline", setOnlineState);
    };
  }, []);

  if (online) return null;
  return (
    <div className="network-status-banner" role="status">
      <strong>You’re offline.</strong> Reconnect to sign in or join an office.
    </div>
  );
}
