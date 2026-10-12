export const API_BASE_URL =
  import.meta.env.VITE_API_URL

export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`)
  }

  return response.json()
}

export async function getPosts() {
  const response = await fetch(`${API_BASE_URL}/api/posts`)

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`)
  }

  return response.json()
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
    const errorData = await response.json()

    throw new Error(
      errorData.detail || `Login failed: ${response.status}`
    )
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
    // FastAPI returns a string for most errors and an array of validation
    // issues for 422 responses. Do not display a raw object in the UI.
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
        : `Post submission failed (${response.status})`

    throw new ApiRequestError(
      response.status === 401 ? "Your login has expired. Please log in again." : message,
      response.status,
    )
  }

  return (await response.json()) as CreatedPost
}
