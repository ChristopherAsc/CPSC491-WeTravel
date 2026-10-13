import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, Compass, LoaderCircle, Plus, RefreshCw } from "lucide-react"
import { getPosts } from "@/api_configs"
import PostCard, { type FeedPost } from "@/components/feed/PostCard"

function isFeedPost(value: unknown): value is FeedPost {
  if (!value || typeof value !== "object") return false
  const post = value as Record<string, unknown>
  return typeof post.post_id === "number" && typeof post.user_id === "number" &&
    typeof post.caption === "string" && typeof post.created_at === "string" &&
    (post.media_url === null || typeof post.media_url === "string")
}

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const fetchPosts = async () => {
      try {
        const response: unknown = await getPosts()
        if (!Array.isArray(response) || !response.every(isFeedPost)) {
          throw new Error("Unexpected response format")
        }
        if (!controller.signal.aborted) {
          setPosts(response)
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Failed to load posts:", err)
          setError("Couldn't load travel posts right now. Please try again.")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void fetchPosts()
    return () => controller.abort()
  }, [retryCount])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setRetryCount((count) => count + 1)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-7 pb-20 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">WeTravel community</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0D3B66]">Explore travel</h1>
          <p className="mt-1 text-sm text-gray-600">Discover places and experiences shared by travelers.</p>
        </div>
        <Link to="/create-post" className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15558b]"><Plus size={17} aria-hidden="true" /> Create post</Link>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-20 text-gray-600"><LoaderCircle className="animate-spin text-[#0D3B66]" size={30} aria-hidden="true" /><p>Loading travel posts...</p></div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center"><AlertCircle className="text-red-600" size={28} aria-hidden="true" /><p className="font-medium text-red-800">{error}</p><button onClick={handleRetry} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100"><RefreshCw size={16} aria-hidden="true" /> Try again</button></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-20 text-center"><Compass className="text-[#0D3B66]" size={35} aria-hidden="true" /><h2 className="text-lg font-semibold text-gray-900">No travel posts yet</h2><p className="max-w-sm text-sm text-gray-600">Be the first traveler to share a destination with the community.</p><Link to="/create-post" className="rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15558b]">Create a post</Link></div>
      ) : (
        <section aria-label="Travel posts" className="space-y-6">{posts.map((post) => <PostCard key={post.post_id} post={post} />)}</section>
      )}
    </main>
  )
}
