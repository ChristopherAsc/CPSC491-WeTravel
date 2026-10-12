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