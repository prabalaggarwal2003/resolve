// Use relative /api so Next.js rewrites to backend (next.config.js). For standalone frontend, set NEXT_PUBLIC_API_URL.
const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || 'https://resolve-backend-77vy.onrender.com';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p.startsWith('/api') ? p : `/api${p}`}`;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
