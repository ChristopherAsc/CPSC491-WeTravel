import { useState } from "react"

import { loginUser, registerUser } from "@/api_configs"
import { useAuth } from "@/auth/useAuth"

function Register() {
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      return
    }

    let registered = false

    try {
      setMessage("Creating account...")

      await registerUser(email, username, password)
      registered = true

      // The backend does not return a token on register, so log in right away
      const loginData = await loginUser(username, password)

      // Store the JWT and load the current user into the shared auth state
      await login(loginData.access_token)

      setMessage(`Account created. Logged in as ${username}`)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Something went wrong"

      setMessage(
        registered
          ? `Account created, but automatic login failed: ${reason}`
          : reason
      )
    }
  }

  return (
    <div>
      <h1>Register</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="username">Username</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={50}
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
            minLength={8}
            maxLength={128}
            required
          />
        </div>

        <div>
          <label htmlFor="confirm-password">Confirm password</label>

          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </div>

        <button type="submit">Register</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  )
}

export default Register