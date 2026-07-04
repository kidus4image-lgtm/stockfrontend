const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_PROXY_PREFIX = '/api-proxy';

export function normalizeApiUrl(url: string) {
  if (!url) return url;
  if (url.startsWith(API_PROXY_PREFIX) || url.startsWith('/api/')) {
    return url;
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : API_ORIGIN);
    if (parsed.origin === API_ORIGIN || parsed.origin === 'http://localhost:5000') {
      return `${API_PROXY_PREFIX}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Leave non-URL inputs untouched so fetch can handle them naturally.
  }

  return url;
}

export function normalizeApiRequest(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string') {
    return normalizeApiUrl(input);
  }

  if (input instanceof URL) {
    return normalizeApiUrl(input.toString());
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Request(normalizeApiUrl(input.url), input);
  }

  return input;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(normalizeApiUrl(url), { ...options, headers });
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return res;
}
