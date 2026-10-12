import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getCurrentUser } from "@/api_configs"
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
} from "@/auth/authContext"
import { onUnauthorized } from "@/auth/authFetch"
import { clearToken, getToken, setToken } from "@/auth/tokenStorage"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => getToken() !== null)

  // Restore the session after a page refresh
  useEffect(() => {
    const savedToken = getToken()

    if (savedToken === null) {
      return
    }

    getCurrentUser(savedToken)
      .then((currentUser: AuthUser) => setUser(currentUser))
      .catch(() => {
        // Invalid or expired token (or backend unavailable): treat as logged out
        clearToken()
        setTokenState(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Any 401 from authFetch ends the session
  useEffect(() => {
    return onUnauthorized(() => {
      setTokenState(null)
      setUser(null)
    })
  }, [])

  const login = useCallback(async (accessToken: string) => {
    setToken(accessToken)
    setTokenState(accessToken)

    try {
      const currentUser: AuthUser = await getCurrentUser(accessToken)
      setUser(currentUser)
    } catch (error) {
      clearToken()
      setTokenState(null)
      setUser(null)

      throw error
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: token !== null,
      isLoading,
      login,
      logout,
    }),
    [token, user, isLoading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
