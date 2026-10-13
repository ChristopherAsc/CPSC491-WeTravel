import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { loginUser } from "@/api_configs"
import { useAuth } from "@/auth/useAuth"

type LocationState = { from?: { pathname?: string } } | null

function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  // ProtectedRoute remembers the page the user was trying to open
  const redirectTo =
    (location.state as LocationState)?.from?.pathname ?? "/feed"

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setMessage("Logging in...")

      // Send username/password to FastAPI
      const loginData = await loginUser(username, password)

      // Store the JWT and load the current user into the shared auth state
      await login(loginData.access_token)

      navigate(redirectTo, { replace: true })
    } catch (error) {
      console.error("Login failed:", error)

      if (error instanceof Error) {
        setMessage(error.message)
      } else {
        setMessage("Login failed")
      }
    }
  }

  return (
    <div>
      <h1>Login</h1>

      {user && <p>Currently logged in as {user.username}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button type="submit">Login</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  )
}

export default Login