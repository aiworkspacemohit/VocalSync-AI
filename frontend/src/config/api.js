/**
 * VocalSync AI — Centralized API and WebSocket Gateway Config
 * Automatically detects whether the client is on localhost, behind an SSL tunnel (Cloudflare/ngrok),
 * or in production cloud hosting.
 */

export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000';
  }
  return typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : 'http://localhost:8000';
}

export function getWsBaseUrl(path = '') {
  const apiBase = getApiBaseUrl();
  let wsRoot = apiBase.replace(/^http/, 'ws');

  if (import.meta.env.VITE_WS_URL) {
    try {
      const u = new URL(import.meta.env.VITE_WS_URL);
      wsRoot = `${u.protocol}//${u.host}`;
    } catch {
      // fallback to wsRoot
    }
  }

  if (path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${wsRoot}${cleanPath}`;
  }

  return wsRoot;
}
