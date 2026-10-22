const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...init,
  })

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    throw body ?? { error: { code: 'network_error', message: `HTTP ${res.status}` } }
  }

  return body as T
}
