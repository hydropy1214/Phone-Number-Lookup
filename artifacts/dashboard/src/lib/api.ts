import axios from 'axios';

export function setAdminSecret(secret: string) {
  // If axios is used by any chance
  axios.defaults.headers.common['X-Admin-Secret'] = secret;
  localStorage.setItem('admin_secret', secret);
}

export function clearAdminSecret() {
  delete axios.defaults.headers.common['X-Admin-Secret'];
  localStorage.removeItem('admin_secret');
}

export function getStoredSecret(): string | null {
  return localStorage.getItem('admin_secret');
}

export function setApiKey(key: string) {
  axios.defaults.headers.common['X-API-Key'] = key;
  localStorage.setItem('api_key', key);
}

export function getApiKey(): string | null {
  return localStorage.getItem('api_key');
}

// Intercept fetch — only inject credentials on same-origin /api/* requests
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);

  // Only attach headers to same-origin /api paths to prevent credential leakage
  const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
  const isApiPath = url.includes('/api/');

  if (isSameOrigin && isApiPath) {
    const secret = getStoredSecret();
    const apiKey = getApiKey();

    const headers = new Headers(init?.headers);
    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        if (!headers.has(key)) headers.set(key, value);
      });
    }

    if (secret) headers.set('X-Admin-Secret', secret);
    if (apiKey) headers.set('X-API-Key', apiKey);

    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};
