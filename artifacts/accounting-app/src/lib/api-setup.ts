import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

export function setupApi() {
  // Read token from localStorage
  setAuthTokenGetter(() => {
    return localStorage.getItem("auth_token");
  });

  // Base URL is determined by current origin for proxy, or env var if needed
  // In Capacitor or production builds, we need a fully qualified URL.
  setBaseUrl(import.meta.env.VITE_API_URL || null); 
}
