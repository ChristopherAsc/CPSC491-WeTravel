import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Compass, LockKeyhole, LogIn, UserRound } from "lucide-react"

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
  const [submitting, setSubmitting] = useState(false)

  // ProtectedRoute remembers the page the user was trying to open
  const redirectTo =
    (location.state as LocationState)?.from?.pathname ?? "/feed"

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)

    try {
      setMessage("Logging in...")

      // Preserve the existing FastAPI login and shared JWT/auth-state flow.
      const loginData = await loginUser(username, password)
      await login(loginData.access_token)

      navigate(redirectTo, { replace: true })
    } catch (error) {
      console.error("Login failed:", error)
      setMessage(error instanceof Error ? error.message : "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-24 md:pb-10">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D3B66]">
          <Compass size={17} aria-hidden="true" />
          <span className="uppercase tracking-wider">Your journey</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66]">Welcome back</h1>
        <p className="max-w-xl text-sm text-gray-600">
          Log in to discover places, share travel experiences, and plan your next adventure.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="login-heading">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0D3B66]">
              <LogIn size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 id="login-heading" className="text-lg font-semibold text-[#0D3B66]">Log in to WeTravel</h2>
              <p className="text-sm text-gray-500">Enter your account credentials below.</p>
            </div>
          </div>

          {user && (
            <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#0D3B66]">
              Currently logged in as {user.username}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
              <div className="relative">
                <UserRound size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-[#0D3B66] focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-[#0D3B66] focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#155383] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={17} aria-hidden="true" />
              Login
            </button>
          </form>

          {message && (
            <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
              {message}
            </p>
          )}

          <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
            New to WeTravel? <a href="/register" className="font-semibold text-[#0D3B66] underline-offset-2 hover:underline">Create an account</a>
          </p>
        </section>

        <aside className="self-start rounded-xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0D3B66]">
            <Compass size={22} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#0D3B66]">Your next adventure awaits</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            Explore the community feed, share memorable destinations, and keep your travel ideas organized in one place.
          </p>
        </aside>
      </div>
    </main>
  )
}

export default Login