import { useContext } from "react"

import { AuthContext, type AuthContextValue } from "@/auth/authContext"

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
