import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authFetch, onUnauthorized } from "@/auth/authFetch"
import { getToken, setToken } from "@/auth/tokenStorage"

function mockFetch(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
    })
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("authFetch", () => {
  it("attaches the Bearer token when logged in", async () => {
    setToken("fake-token")
    mockFetch(200)

    await authFetch("/api/posts")

    const [url, options] = vi.mocked(fetch).mock.calls[0]

    expect(String(url)).toContain("/api/posts")
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer fake-token"
    )
  })

  it("sends no Authorization header when there is no token", async () => {
    mockFetch(200)

    await authFetch("/api/posts")

    const [, options] = vi.mocked(fetch).mock.calls[0]

    expect(new Headers(options?.headers).has("Authorization")).toBe(false)
  })

  it("clears the token and notifies listeners on 401", async () => {
    setToken("expired-token")
    mockFetch(401)

    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await authFetch("/api/users/me")

    expect(getToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it("keeps the token on other errors", async () => {
    setToken("fake-token")
    mockFetch(500)

    await authFetch("/api/posts")

    expect(getToken()).toBe("fake-token")
  })
})
