import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

export function setupApi() {
  // Read token from localStorage
  setAuthTokenGetter(() => {
    return localStorage.getItem("auth_token");
  });

  // Base URL is determined by current origin for proxy, or env var if needed
  // In Replit, relative paths to /api will be handled correctly by Vite proxy
  setBaseUrl(null); 
}
