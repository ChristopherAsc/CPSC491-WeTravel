import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, CalendarDays, Compass, FileText, LogIn, Mail,MapPin, Plus, RefreshCw, ShieldCheck, UserRound,} from "lucide-react"
import { getCurrentUser } from "@/api_configs"

type ProfileUser = {
  username: string
  email?: string
  user_id?: number
}

const DRAFT_KEY = "wetravel_itinerary_drafts_v1"

function readDraftCount(): number {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return 0
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((entry) =>
      entry !== null && typeof entry === "object" &&
      "title" in entry && typeof entry.title === "string" &&
      "destinations" in entry && Array.isArray(entry.destinations),
    ).length : 0
  } catch {
    return 0
  }
}

function parseUser(value: unknown): ProfileUser {
  if (!value || typeof value !== "object") throw new Error("Unexpected profile response")
  const user = value as Record<string, unknown>
  if (typeof user.username !== "string") throw new Error("Profile username is missing")
  return {
    username: user.username,
    email: typeof user.email === "string" ? user.email : undefined,
    user_id: typeof user.user_id === "number" ? user.user_id : undefined,
  }
}

const actionClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#155383]"
const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0D3B66] transition hover:bg-blue-50"

export default function Profile() {
  const [token] = useState(() => localStorage.getItem("access_token"))
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(Boolean(token))
  const [reload, setReload] = useState(0)
  const [draftCount] = useState(readDraftCount)

  useEffect(() => {
    if (!token) return
    let active = true
    async function loadProfile() {
      try {
        const response: unknown = await getCurrentUser(token as string)
        const profile = parseUser(response)
        if (active) {
          setUser(profile)
          setError("")
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load your profile")
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [token, reload])

  function retry() {
    setLoading(true)
    setError("")
    setReload((value) => value + 1)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-24 md:pb-10">
      <header>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#0D3B66]"><Compass size={17} aria-hidden="true" /> YOUR JOURNEY</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66]">Traveler profile</h1>
        <p className="mt-2 text-sm text-gray-600">Your WeTravel identity, travel plans, and shared experiences in one place.</p>
      </header>

      {!token ? (
        <section className="rounded-xl border border-gray-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0D3B66]"><UserRound size={30} aria-hidden="true" /></div>
          <h2 className="text-xl font-semibold text-[#0D3B66]">Sign in to view your profile</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">Your account details and future travel activity will appear here after you sign in.</p>
          <Link to="/login" className={`${actionClass} mt-5`}><LogIn size={17} aria-hidden="true" /> Go to Login</Link>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="h-20 bg-[#0D3B66] sm:h-24" />
            <div className="px-5 pb-6 sm:px-7">
              <div className="-mt-9 mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-blue-50 text-[#0D3B66] shadow-sm"><UserRound size={36} aria-hidden="true" /></div>
              {loading ? (
                <p role="status" className="text-sm text-gray-600">Loading your profile...</p>
              ) : error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <AlertCircle size={18} aria-hidden="true" /><span className="flex-1">{error}</span>
                  <button type="button" onClick={retry} className={secondaryClass}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
                </div>
              ) : user ? (
                <>
                  <h2 className="text-2xl font-bold text-[#0D3B66]">{user.username}</h2>
                  <p className="mt-1 text-sm text-gray-500">WeTravel community member</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
                    {user.email && <span className="inline-flex items-center gap-2"><Mail size={16} aria-hidden="true" /> {user.email}</span>}
                    {user.user_id !== undefined && <span className="inline-flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" /> User #{user.user_id}</span>}
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
            <div className="space-y-5">
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-[#0D3B66]"><MapPin size={20} aria-hidden="true" /><h2 className="text-lg font-semibold">Your travel space</h2></div>
                <p className="mb-4 text-sm text-gray-600">Jump back into exploring, sharing, or planning your next destination.</p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/create-post" className={actionClass}><Plus size={17} aria-hidden="true" /> Create post</Link>
                  <Link to="/itinerary" className={secondaryClass}><CalendarDays size={17} aria-hidden="true" /> My itineraries</Link>
                  <Link to="/feed" className={secondaryClass}><Compass size={17} aria-hidden="true" /> Explore Feed</Link>
                </div>
              </section>
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-[#0D3B66]"><FileText size={20} aria-hidden="true" /><h2 className="text-lg font-semibold">My travel posts</h2></div>
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <FileText size={28} className="mx-auto mb-2 text-gray-400" aria-hidden="true" />
                  <p className="font-medium text-gray-800">Post history coming soon</p>
                  <p className="mt-1 text-sm text-gray-600">Your posts will appear here when account-specific post retrieval is connected.</p>
                </div>
              </section>
            </div>
            <div className="space-y-5">
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-[#0D3B66]"><CalendarDays size={20} aria-hidden="true" /><h2 className="text-lg font-semibold">Travel planning</h2></div>
                <p className="text-3xl font-bold text-[#0D3B66]">{draftCount}</p>
                <p className="mt-1 text-sm text-gray-600">Itinerary {draftCount === 1 ? "draft" : "drafts"} saved in this browser</p>
                <Link to="/itinerary" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0D3B66] hover:underline">View itineraries <span aria-hidden="true">→</span></Link>
              </section>
              <section role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <h2 className="font-semibold">Profile preview</h2>
                <p className="mt-2">Account information comes from the current-user API. Profile editing, avatars, and account-specific post history are planned integrations. Itinerary drafts are stored only in this browser.</p>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
