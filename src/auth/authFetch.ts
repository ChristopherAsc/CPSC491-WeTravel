import { API_BASE_URL } from "@/api_configs"
import { clearToken, getToken } from "@/auth/tokenStorage"

type UnauthorizedListener = () => void

const unauthorizedListeners = new Set<UnauthorizedListener>()

// Lets the auth state (AuthProvider) find out when the backend rejects the token
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)

  return () => {
    unauthorizedListeners.delete(listener)
  }
}

// Use this for every protected API request. `path` starts with "/api/...".
export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)
  const token = getToken()

  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    // Token is invalid or expired: end the session everywhere
    clearToken()
    unauthorizedListeners.forEach((listener) => listener())
  }

  return response
}
