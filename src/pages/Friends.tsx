import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Clock3, HeartHandshake, RefreshCw, UserMinus, UserRoundSearch, UsersRound, X } from "lucide-react"
import { useAuth } from "@/auth/useAuth"
import { socialRequest, type FriendRequest, type PublicTraveler } from "@/socialApi"
import TravelerAvatar from "@/components/social/TravelerAvatar"

const primaryButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#155383] disabled:opacity-50"
const outlineButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"

export default function Friends() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<PublicTraveler[]>([])
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  useEffect(() => {
    let active = true
    Promise.all([socialRequest<FriendRequest[]>("/friends/requests"), socialRequest<PublicTraveler[]>("/friends")])
      .then(([reqs, people]) => { if (active) { setRequests(reqs); setFriends(people); setError("") } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load friends") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  async function action(path: string, method: string, success: string) {
    if (busy) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await socialRequest(path, method)
      setMessage(success)
      setReload(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed")
    } finally { setBusy(false) }
  }

  const incoming = requests.filter(r => r.recipient.user_id === user?.user_id && r.status === "pending")
  const outgoing = requests.filter(r => r.sender.user_id === user?.user_id && r.status === "pending")

  return <main className="mx-auto max-w-5xl space-y-6 pb-20">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Your community</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0D3B66]">Friends & Requests</h1><p className="mt-2 text-sm text-gray-600">Stay connected with travelers and manage your invitations in one place.</p></div>
      <button type="button" className={outlineButton} onClick={() => { setLoading(true); setReload(v => v + 1) }}><RefreshCw size={16} /> Refresh</button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {loading ? <p role="status" className="rounded-xl border border-gray-200 bg-white p-7 text-gray-600">Loading your connections...</p> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><UsersRound className="mb-3 text-[#0D3B66]" size={24}/><p className="text-3xl font-bold text-[#0D3B66]">{friends.length}</p><p className="text-sm text-gray-600">Friends</p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><HeartHandshake className="mb-3 text-[#0D3B66]" size={24}/><p className="text-3xl font-bold text-[#0D3B66]">{incoming.length}</p><p className="text-sm text-gray-600">Incoming requests</p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><Clock3 className="mb-3 text-[#0D3B66]" size={24}/><p className="text-3xl font-bold text-[#0D3B66]">{outgoing.length}</p><p className="text-sm text-gray-600">Sent requests</p></div>
      </div>
      <section aria-labelledby="incoming-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5"><h2 id="incoming-heading" className="text-xl font-bold text-[#0D3B66]">Friend requests</h2><p className="mt-1 text-sm text-gray-500">Review invitations from travelers who want to connect.</p></div>
        {incoming.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-7 text-center"><HeartHandshake className="mx-auto mb-2 text-gray-400" size={28}/><p className="font-medium text-gray-800">You're all caught up</p><p className="mt-1 text-sm text-gray-500">New invitations will appear here.</p></div> :
          <ul className="divide-y divide-gray-100">{incoming.map(r => <li key={r.request_id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
            <Link to={`/travelers/${r.sender.user_id}`}><TravelerAvatar username={r.sender.username} avatarUrl={r.sender.avatar_url}/></Link>
            <div className="min-w-0 flex-1"><Link to={`/travelers/${r.sender.user_id}`} className="break-words font-semibold text-[#0D3B66] hover:underline">{r.sender.username}</Link><p className="text-sm text-gray-500">Wants to connect with you</p></div>
            <div className="flex w-full gap-2 sm:w-auto"><button type="button" disabled={busy} className={primaryButton} onClick={() => void action(`/friends/requests/${r.request_id}?decision=accept`, "PATCH", `${r.sender.username} is now your friend`)}><Check size={16}/> Accept</button><button type="button" disabled={busy} className={outlineButton} onClick={() => void action(`/friends/requests/${r.request_id}?decision=decline`, "PATCH", "Request declined")}><X size={16}/> Decline</button></div>
          </li>)}</ul>}
      </section>
      <section aria-labelledby="friends-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5"><h2 id="friends-heading" className="text-xl font-bold text-[#0D3B66]">Your friends</h2><p className="mt-1 text-sm text-gray-500">People you're connected with on WeTravel.</p></div>
        {friends.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-7 text-center"><UsersRound className="mx-auto mb-2 text-gray-400" size={28}/><p className="font-medium text-gray-800">No friends yet</p><p className="mt-1 text-sm text-gray-500">Find travelers through the navigation search bar to get started.</p></div> :
          <ul className="grid gap-3 sm:grid-cols-2">{friends.map(friend => <li key={friend.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-4">
            <Link to={`/travelers/${friend.user_id}`}><TravelerAvatar username={friend.username} avatarUrl={friend.avatar_url}/></Link>
            <div className="min-w-0 flex-1"><Link to={`/travelers/${friend.user_id}`} className="break-words font-semibold text-[#0D3B66] hover:underline">{friend.username}</Link><p className="text-xs text-green-700">Connected</p></div>
            <button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50" onClick={() => { if (window.confirm(`Remove ${friend.username} from friends?`)) void action(`/friends/${friend.user_id}`, "DELETE", "Friend removed") }}><UserMinus size={15}/> Remove</button>
          </li>)}</ul>}
      </section>
      <section aria-labelledby="outgoing-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5"><h2 id="outgoing-heading" className="text-xl font-bold text-[#0D3B66]">Sent requests</h2><p className="mt-1 text-sm text-gray-500">Invitations you've sent that are waiting for a response.</p></div>
        {outgoing.length === 0 ? <p className="rounded-xl bg-gray-50 p-6 text-sm text-gray-500">No pending outgoing requests.</p> : <ul className="divide-y divide-gray-100">{outgoing.map(r => <li key={r.request_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><TravelerAvatar username={r.recipient.username} avatarUrl={r.recipient.avatar_url} size="sm"/><div className="min-w-0 flex-1"><Link to={`/travelers/${r.recipient.user_id}`} className="break-words font-semibold text-[#0D3B66] hover:underline">{r.recipient.username}</Link><p className="text-sm text-gray-500">Awaiting response</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Pending</span></li>)}</ul>}
      </section>
      <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm text-[#0D3B66]"><UserRoundSearch size={20} aria-hidden="true" /> To discover new travelers, use the search bar in the navigation.</div>
    </>}
  </main>
}
