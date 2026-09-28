import { useState } from "react"

import { getCurrentUser, loginUser } from "@/api_configs"

function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(
  event: React.SubmitEvent<HTMLFormElement>
) {
  event.preventDefault()

  try {
    setMessage("Logging in...")

    // Send username/password to FastAPI
    const loginData = await loginUser(username, password)

    // Store JWT returned by the backend
    localStorage.setItem("access_token", loginData.access_token)

    // Verify that the JWT works on a protected endpoint
    const currentUser = await getCurrentUser(loginData.access_token)

    console.log("Authenticated user:", currentUser)

    setMessage(`Logged in as ${currentUser.username}`)
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

        <button type="submit">
          Login
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  )
}

export default Login