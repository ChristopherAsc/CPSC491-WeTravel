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