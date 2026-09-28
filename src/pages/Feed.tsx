import { getPosts } from "@/api_configs"
import { useEffect, useState } from "react"

type Location = {
  name: string
  latitude: number
  longitude: number
}

type Post = {
  post_id: number
  user_id: number
  caption: string
  media_url: string | null
  location: Location
  created_at: string
}

function Feed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPosts()
      .then((data) => {
        setPosts(data)
      })
      .catch((error) => {
        console.error("Failed to load posts:", error)
        setError("Failed to load posts.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p>Loading posts...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  if (posts.length === 0) {
    return <p>No posts available.</p>
  }

  return (
    <div>
      <h1>Travel Feed</h1>

      {posts.map((post) => (
        <div key={post.post_id}>
          <h2>{post.location.name}</h2>
          <p>{post.caption}</p>
          <p>
            {post.location.latitude}, {post.location.longitude}
          </p>
        </div>
      ))}
    </div>
  )
}

export default Feed