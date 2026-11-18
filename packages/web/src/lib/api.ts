const API_BASE = import.meta.env.VITE_API_URL || ''

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const prefix = `${name}=`
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrfToken = readCookie('csrf_token')
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}
