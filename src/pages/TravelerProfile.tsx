import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { CalendarDays, ImageOff, LockKeyhole, MapPin, RefreshCw, UserCheck, UserPlus } from "lucide-react"
import { useAuth } from "@/auth/useAuth"
import { socialRequest, type FriendRequest, type PublicTraveler } from "@/socialApi"
import type { FeedPost } from "@/components/feed/PostCard"
import TravelerAvatar from "@/components/social/TravelerAvatar"

export default function TravelerProfile() {
  const { userId } = useParams()
  const id = Number(userId)
  const { user: currentUser } = useAuth()
  const [traveler, setTraveler] = useState<PublicTraveler | null>(null)
  const [request, setRequest] = useState<FriendRequest | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loadedId, setLoadedId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [postError, setPostError] = useState("")
  const [postsLoadedId, setPostsLoadedId] = useState<number | null>(null)
  const [postPrivacy, setPostPrivacy] = useState<boolean | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [postRefresh, setPostRefresh] = useState(0)

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return
    let active = true
    Promise.all([
      socialRequest<PublicTraveler>(`/users/${id}`),
      socialRequest<FriendRequest[]>("/friends/requests"),
    ]).then(([person, requests]) => {
      if (!active) return
      setTraveler(person)
      setRequest(requests.find(item => item.sender.user_id === id || item.recipient.user_id === id) ?? null)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Profile unavailable")
    }).finally(() => { if (active) setLoadedId(id) })
    return () => { active = false }
  }, [id, refresh])

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0 || loadedId !== id || !traveler) return
    let active = true
    socialRequest<FeedPost[]>(`/users/${id}/posts`).then(result => {
      if (active) {
        setPostPrivacy(false)
        setPostError("")
        setPosts([...result].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)))
        setPostsLoadedId(id)
      }
    }).catch((reason: unknown) => {
      if (!active) return
      setPosts([])
      if (reason instanceof Error && reason.message === "This profile is private") {
        setPostPrivacy(true)
        setPostError("")
      } else {
        setPostPrivacy(false)
        setPostError(reason instanceof Error ? reason.message : "Unable to load travel posts")
      }
      setPostsLoadedId(id)
    })
    return () => { active = false }
  }, [id, loadedId, traveler, postRefresh, currentUser?.user_id, request?.status])

  async function addFriend() {
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      await socialRequest(`/friends/requests/${id}`, "POST")
      setRefresh(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send friend request")
    } finally { setSubmitting(false) }
  }

  async function respond(decision: "accept" | "decline") {
    if (submitting || !request) return
    setError("")
    setSubmitting(true)
    try {
      await socialRequest(`/friends/requests/${request.request_id}?decision=${decision}`, "PATCH")
      setRefresh(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to respond to request")
    } finally { setSubmitting(false) }
  }

  const invalidId = !Number.isInteger(id) || id <= 0
  const loading = !invalidId && loadedId !== id
  const visibleTraveler = !loading && !invalidId ? traveler : null
  const isOwnProfile = currentUser?.user_id === id
  const isIncoming = request?.status === "pending" && request.recipient.user_id === currentUser?.user_id
  const isOutgoing = request?.status === "pending" && request.sender.user_id === currentUser?.user_id

  return <main className="mx-auto max-w-5xl space-y-6 pb-20">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Traveler community</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0D3B66]">Traveler profile</h1></div>
    {loading && <p role="status" className="rounded-xl border bg-white p-6 text-gray-600">Loading traveler...</p>}
    {invalidId && <p role="alert" className="text-red-700">Invalid traveler profile</p>}
    {!loading && error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    {visibleTraveler && <>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-[#0D3B66] to-[#36799c]" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-10 mb-4 w-fit rounded-full border-4 border-white bg-white"><TravelerAvatar username={visibleTraveler.username} avatarUrl={visibleTraveler.avatar_url} size="lg" /></div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="break-words text-2xl font-bold text-[#0D3B66]">{visibleTraveler.username}</h2><p className="mt-1 text-sm text-gray-500">WeTravel community member</p></div>
            <div className="rounded-xl bg-blue-50 px-5 py-3 text-center"><p className="text-xl font-bold text-[#0D3B66]">{postPrivacy === true ? "--" : posts.length}</p><p className="text-xs font-medium text-gray-600">Travel posts</p></div>
          </div>
          {!isOwnProfile && <div className="mt-5 flex flex-wrap items-center gap-3">
            {request?.status === "accepted" ?
              <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 font-medium text-green-800"><UserCheck size={18} /> Friends</span>
            : isOutgoing ? <span className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700">Request Pending</span>
            : isIncoming ? <>
              <button type="button" onClick={() => { void respond("accept") }} disabled={submitting} className="rounded-lg bg-[#0D3B66] px-4 py-2 font-medium text-white disabled:opacity-50">Accept Request</button>
              <button type="button" onClick={() => { void respond("decline") }} disabled={submitting} className="rounded-lg border px-4 py-2 font-medium text-gray-800 disabled:opacity-50">Decline Request</button>
            </> : request?.status === "declined" ? <span className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700">Request Declined</span>
            : <button type="button" onClick={() => { void addFriend() }} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2 font-medium text-white disabled:opacity-50"><UserPlus size={18} /> {submitting ? "Sending..." : "Add Friend"}</button>}
          </div>}
        </div>
      </section>
      <section aria-label="Traveler posts" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-semibold text-[#0D3B66]">Travel posts</h3><p className="mt-1 text-sm text-gray-500">Experiences shared by {visibleTraveler.username}</p></div><button type="button" disabled={postPrivacy === true} onClick={() => setPostRefresh(v => v + 1)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#0D3B66] hover:bg-gray-50"><RefreshCw size={15} /> Refresh</button></div>
        {postPrivacy === true ? <div className="rounded-xl border border-gray-200 bg-slate-50 p-10 text-center" role="status"><LockKeyhole size={34} className="mx-auto mb-3 text-[#0D3B66]" /><h4 className="text-lg font-semibold text-[#0D3B66]">This profile is private</h4><p className="mt-2 text-sm text-gray-600">Only accepted friends can view this traveler’s posts.</p></div>
        : postsLoadedId !== id ? <p role="status" className="rounded-xl bg-gray-50 p-6 text-sm text-gray-500">Loading travel posts...</p> : postError ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">{postError}</p>
        : posts.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center"><ImageOff className="mx-auto mb-3 text-gray-400" size={30} /><p className="font-semibold text-gray-800">No travel posts yet</p><p className="mt-1 text-sm text-gray-500">This traveler hasn't shared an experience yet.</p></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <article key={post.post_id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex aspect-[4/3] items-center justify-center bg-slate-100">{post.media_url ? <img src={post.media_url} alt={`Travel post from ${visibleTraveler.username}`} loading="lazy" className="h-full w-full object-cover" /> : <ImageOff size={30} className="text-gray-400" aria-label="Post without a photo" />}</div>
            <div className="space-y-3 p-4"><p className="line-clamp-3 min-h-12 whitespace-pre-wrap break-words text-sm text-gray-800">{post.caption}</p><div className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500"><p className="flex items-center gap-1"><MapPin size={13} /> {post.location?.name ?? "Location not specified"}</p><p className="flex items-center gap-1"><CalendarDays size={13} /> {new Date(post.created_at).toLocaleDateString()}</p></div></div>
          </article>)}</div>}
      </section>
    </>}
  </main>
}
