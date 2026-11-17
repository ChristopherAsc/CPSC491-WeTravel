export const API_BASE_URL =
  import.meta.env.VITE_API_URL

export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`)
  }

  return response.json()
}

// A token is optional: signed-in viewers also get their own like state back
export async function getPosts(token?: string | null) {
  const response = await fetch(
    `${API_BASE_URL}/api/posts`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`)
  }

  return response.json()
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const errorData = await response.json()

    if (typeof errorData.detail === "string") {
      return errorData.detail
    }

    // FastAPI validation errors (422) return a list of objects
    if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      const first = errorData.detail[0]
      const field = first.loc?.[first.loc.length - 1]

      return field ? `${field}: ${first.msg}` : first.msg
    }
  } catch {
    // Response body was not JSON
  }

  return `${fallback}: ${response.status}`
}

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Login failed"))
  }

  return response.json()
}

export async function getCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load current user: ${response.status}`)
  }

  return response.json()
}


export async function registerUser(
  email: string,
  username: string,
  password: string
) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      username,
      password,
    }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Registration failed"))
  }

  return response.json()
}

export type PostCreatePayload = {
  caption: string
  media_url: string | null
  location: {
    name: string
    latitude: number
    longitude: number
  }
}

export type CreatedPost = {
  post_id: number
  user_id: number
  username: string
  caption: string
  media_url: string | null
  location: PostCreatePayload["location"]
  created_at: string
}

export class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export async function createPost(payload: PostCreatePayload, token: string): Promise<CreatedPost> {
  const response = await fetch(`${API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toApiRequestError(response, `Post submission failed (${response.status})`)
  }

  return (await response.json()) as CreatedPost
}

// Turns a failed response into an ApiRequestError with a message safe to display.
// FastAPI returns a string for most errors and an array of validation issues
// for 422 responses. Do not display a raw object in the UI.
async function toApiRequestError(response: Response, fallback: string): Promise<ApiRequestError> {
  if (response.status === 401) {
    return new ApiRequestError("Your login has expired. Please log in again.", 401)
  }

  const body: unknown = await response.json().catch(() => null)
  const detail = body && typeof body === "object" && "detail" in body
    ? body.detail
    : null
  const message = typeof detail === "string"
    ? detail
    : Array.isArray(detail)
      ? detail.map((issue: unknown) => {
          if (issue && typeof issue === "object" && "msg" in issue && typeof issue.msg === "string") {
            return issue.msg
          }
          return "Invalid request"
        }).join("; ")
      : fallback

  return new ApiRequestError(message, response.status)
}

export type PostLikeState = {
  post_id: number
  liked: boolean
  like_count: number
}

// Likes the post, or removes the user's like if they already liked it
export async function togglePostLike(postId: number, token: string): Promise<PostLikeState> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/likes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw await toApiRequestError(response, `Could not update your like (${response.status})`)
  }

  return (await response.json()) as PostLikeState
}

export type PostComment = {
  comment_id: number
  post_id: number
  user_id: number
  username: string
  content: string
  created_at: string
}

function isPostComment(value: unknown): value is PostComment {
  if (!value || typeof value !== "object") return false
  const comment = value as Record<string, unknown>

  return typeof comment.comment_id === "number" && typeof comment.post_id === "number" &&
    typeof comment.user_id === "number" && typeof comment.username === "string" &&
    typeof comment.content === "string" && typeof comment.created_at === "string"
}

// Comments are public to read; a token is only needed for private profiles' posts
export async function getPostComments(postId: number, token?: string | null): Promise<PostComment[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/posts/${postId}/comments`,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  )

  if (!response.ok) {
    throw await toApiRequestError(response, `Could not load comments (${response.status})`)
  }

  const body: unknown = await response.json()

  if (!Array.isArray(body) || !body.every(isPostComment)) {
    throw new Error("Unexpected response format")
  }

  return body
}

export async function createPostComment(postId: number, content: string, token: string): Promise<PostComment> {
  const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    throw await toApiRequestError(response, `Could not post your comment (${response.status})`)
  }

  const body: unknown = await response.json()

  if (!isPostComment(body)) {
    throw new Error("Unexpected response format")
  }

  return body
}
