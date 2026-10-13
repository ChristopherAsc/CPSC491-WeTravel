import { useState } from "react"
import { Compass, LockKeyhole, Mail, UserPlus, UserRound } from "lucide-react"

import { loginUser, registerUser } from "@/api_configs"
import { useAuth } from "@/auth/useAuth"

function Register() {
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      return
    }

    let registered = false
    setSubmitting(true)

    try {
      setMessage("Creating account...")

      await registerUser(email, username, password)
      registered = true

      // Registration returns no JWT; preserve the automatic login flow.
      const loginData = await loginUser(username, password)
      await login(loginData.access_token)

      setMessage(`Account created. Logged in as ${username}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Something went wrong"
      setMessage(
        registered
          ? `Account created, but automatic login failed: ${reason}`
          : reason
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-[#0D3B66] focus:ring-2 focus:ring-blue-100"

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-24 md:pb-10">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D3B66]">
          <Compass size={17} aria-hidden="true" />
          <span className="uppercase tracking-wider">Your journey</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66]">Join the WeTravel community</h1>
        <p className="max-w-xl text-sm text-gray-600">
          Create an account to share your experiences and start planning memorable trips.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="register-heading">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0D3B66]">
              <UserPlus size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 id="register-heading" className="text-lg font-semibold text-[#0D3B66]">Create your account</h2>
              <p className="text-sm text-gray-500">Just a few details to get started.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <Mail size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
              <div className="relative">
                <UserRound size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="username" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={50} required placeholder="Choose a username" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required placeholder="8 characters minimum" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
              <div className="relative">
                <LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required placeholder="Re-enter your password" className={inputClass} />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#155383] disabled:cursor-not-allowed disabled:opacity-60">
              <UserPlus size={17} aria-hidden="true" />
              Register
            </button>
          </form>

          {message && (
            <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
              {message}
            </p>
          )}

          <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
            Already have an account? <a href="/login" className="font-semibold text-[#0D3B66] underline-offset-2 hover:underline">Log in</a>
          </p>
        </section>

        <aside className="self-start rounded-xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0D3B66]">
            <Compass size={22} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#0D3B66]">Start exploring with WeTravel</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            Join fellow travelers, explore shared destinations, and build itineraries for your next adventure.
          </p>
          <p className="mt-4 rounded-lg border border-blue-200 bg-white px-3 py-3 text-sm text-gray-700">
            Accounts use the same login and registration services already connected to your WeTravel backend.
          </p>
        </aside>
      </div>
    </main>
  )
}

export default Register
