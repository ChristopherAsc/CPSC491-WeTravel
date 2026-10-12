import { useState } from "react"

import { loginUser } from "@/api_configs"
import { useAuth } from "@/auth/useAuth"

function Login() {
  const { login, user } = useAuth()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setMessage("Logging in...")

      // Send username/password to FastAPI
      const loginData = await loginUser(username, password)

      // Store the JWT and load the current user into the shared auth state
      await login(loginData.access_token)

      setMessage(`Logged in as ${username}`)
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

      {/* Visible proof that the session survives a refresh (until the Navbar shows it) */}
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