import { createContext } from "react"

export type AuthUser = {
  user_id: number
  username: string
  email: string
}

export type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  // True while a saved session is being restored after a page refresh
  isLoading: boolean
  // Stores the JWT and loads the current user. Throws if the user cannot be loaded.
  login: (accessToken: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
