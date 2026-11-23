/**
 * FleetGate Unified API Helper
 * Automatically handles API endpoints across:
 * - GitHub Pages (udhayak93.github.io) -> proxies to live cloud backend
 * - Vercel (fleetgate-five.vercel.app) -> relative /api
 * - Render (fleetgate.onrender.com) -> relative /api
 * - Local Development -> relative /api
 */

export function getApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  // If running on GitHub Pages or file:// protocol, route to live cloud backend
  if (host.includes('github.io') || window.location.protocol === 'file:') {
    return 'https://fleetgate-five.vercel.app';
  }
  return '';
}

export function apiUrl(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function apiFetch(path, options = {}) {
  const url = apiUrl(path);
  return fetch(url, options);
}
