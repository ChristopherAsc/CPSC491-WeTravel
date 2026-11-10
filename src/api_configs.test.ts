import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiRequestError, createPost, loginUser, registerUser } from "@/api_configs"

function mockFetch(status: number, json: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json,
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("registerUser", () => {
  it("sends email, username and password to the register endpoint", async () => {
    mockFetch(201, async () => ({
      message: "User registered successfully",
      user_id: 1,
    }))

    await registerUser("a@b.com", "tester", "password123")

    const [url, options] = vi.mocked(fetch).mock.calls[0]

    expect(String(url)).toContain("/api/auth/register")
    expect(JSON.parse(options?.body as string)).toEqual({
      email: "a@b.com",
      username: "tester",
      password: "password123",
    })
  })

  it("throws the backend message for a duplicate username", async () => {
    mockFetch(409, async () => ({ detail: "Username is already taken" }))

    await expect(
      registerUser("a@b.com", "tester", "password123")
    ).rejects.toThrow("Username is already taken")
  })

  it("formats FastAPI validation errors (422)", async () => {
    mockFetch(422, async () => ({
      detail: [
        {
          loc: ["body", "password"],
          msg: "String should have at least 8 characters",
        },
      ],
    }))

    await expect(registerUser("a@b.com", "tester", "short")).rejects.toThrow(
      "password: String should have at least 8 characters"
    )
  })
})

describe("loginUser", () => {
  it("throws the backend message for wrong credentials", async () => {
    mockFetch(401, async () => ({ detail: "Invalid username or password" }))

    await expect(loginUser("tester", "wrong")).rejects.toThrow(
      "Invalid username or password"
    )
  })

  it("falls back to the status code when the body is not JSON", async () => {
    mockFetch(500, async () => {
      throw new Error("not json")
    })

    await expect(loginUser("tester", "password123")).rejects.toThrow(
      "Login failed: 500"
    )
  })
})

describe("createPost", () => {
  const payload = {
    caption: "Sunrise over Half Dome",
    media_url: null,
    location: { name: "Yosemite National Park", latitude: 37.8651, longitude: -119.5383 },
  }

  it("sends the post with the bearer token to the posts endpoint", async () => {
    mockFetch(201, async () => ({ post_id: 1, user_id: 7, ...payload, created_at: "2026-11-02T18:00:00Z" }))

    const created = await createPost(payload, "test-token")

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/api/posts")
    expect(options?.method).toBe("POST")
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token")
    expect(JSON.parse(options?.body as string)).toEqual(payload)
    expect(created.post_id).toBe(1)
  })

  it("reports an expired login as a 401 ApiRequestError", async () => {
    mockFetch(401, async () => ({ detail: "Invalid or expired token" }))

    const error = await createPost(payload, "expired-token").catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 401, message: "Your login has expired. Please log in again." })
  })

  it("joins FastAPI validation messages (422)", async () => {
    mockFetch(422, async () => ({
      detail: [{ msg: "Value error, Caption cannot be blank" }, { msg: "Input should be less than or equal to 90" }],
    }))

    await expect(createPost(payload, "test-token")).rejects.toThrow(
      "Value error, Caption cannot be blank; Input should be less than or equal to 90"
    )
  })
})
