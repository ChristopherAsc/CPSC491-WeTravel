import { useEffect, useState } from "react"

import { authFetch } from "@/auth/authFetch"
import { useAuth } from "@/auth/useAuth"

type ProfilePost = {
  post_id: number
  caption: string
  location: { name: string }
}

type PostsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; posts: ProfilePost[] }

function Profile() {
  const { user } = useAuth()
  const [postsState, setPostsState] = useState<PostsState>({
    status: "loading",
  })

  useEffect(() => {
    let cancelled = false

    authFetch("/api/users/me/posts")
      .then(async (response) => {
        // 401: authFetch already ended the session and ProtectedRoute redirects
        if (cancelled || response.status === 401) {
          return
        }

        if (!response.ok) {
          setPostsState({
            status: "error",
            message: `Failed to load your posts (${response.status})`,
          })
          return
        }

        const posts = (await response.json()) as ProfilePost[]

        if (!cancelled) {
          setPostsState({ status: "ready", posts })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPostsState({
            status: "error",
            message: "Cannot reach the server. Please try again.",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-[#0D3B66]">Profile</h1>

      {user ? (
        <div>
          <p>Username: {user.username}</p>
          <p>Email: {user.email}</p>
        </div>
      ) : (
        <p>Your account details are not available right now. Please try again later.</p>
      )}

      <h2 className="text-xl font-semibold">Your posts</h2>

      {postsState.status === "loading" && <p>Loading your posts...</p>}

      {postsState.status === "error" && (
        <p role="alert">{postsState.message}</p>
      )}

      {postsState.status === "ready" && postsState.posts.length === 0 && (
        <p>You have not posted anything yet.</p>
      )}

      {postsState.status === "ready" && postsState.posts.length > 0 && (
        <ul className="space-y-2">
          {postsState.posts.map((post) => (
            <li
              key={post.post_id}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <span>{post.caption}</span>{" "}
              <span className="text-sm text-gray-500">
                ({post.location.name})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Profile