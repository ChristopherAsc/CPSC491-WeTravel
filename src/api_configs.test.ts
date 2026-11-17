import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiRequestError, createPost, createPostComment, getPostComments, getPosts, loginUser, registerUser, togglePostLike } from "@/api_configs"

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

describe("getPosts", () => {
  it("sends the token when one is provided so liked posts are marked", async () => {
    mockFetch(200, async () => [])

    await getPosts("example-test-token")

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/api/posts")
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer example-test-token")
  })

  it("makes an anonymous request when no token is provided", async () => {
    mockFetch(200, async () => [])

    await getPosts()

    expect(vi.mocked(fetch).mock.calls[0][1]).toBeUndefined()
  })
})

describe("togglePostLike", () => {
  it("posts to the like endpoint with the token and returns the new state", async () => {
    mockFetch(200, async () => ({ post_id: 7, liked: true, like_count: 4 }))

    const result = await togglePostLike(7, "example-test-token")

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/api/posts/7/likes")
    expect(options?.method).toBe("POST")
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer example-test-token")
    expect(result).toEqual({ post_id: 7, liked: true, like_count: 4 })
  })

  it("reports an expired login on 401", async () => {
    mockFetch(401, async () => ({ detail: "Invalid authentication token" }))

    await expect(togglePostLike(7, "stale")).rejects.toMatchObject({
      status: 401,
      message: "Your login has expired. Please log in again.",
    })
  })

  it("throws the backend message when the post cannot be found", async () => {
    mockFetch(404, async () => ({ detail: "Post not found" }))

    await expect(togglePostLike(7, "token")).rejects.toMatchObject({
      status: 404,
      message: "Post not found",
    })
  })
})

const sampleComment = {
  comment_id: 1,
  post_id: 7,
  user_id: 2,
  username: "wanderer2",
  content: "Looks like an amazing trip!",
  created_at: "2026-11-11T10:00:00Z",
}

describe("getPostComments", () => {
  it("loads the comments for a post", async () => {
    mockFetch(200, async () => [sampleComment])

    const result = await getPostComments(7)

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("/api/posts/7/comments")
    expect(vi.mocked(fetch).mock.calls[0][1]).toBeUndefined()
    expect(result).toEqual([sampleComment])
  })

  it("sends the token when one is provided", async () => {
    mockFetch(200, async () => [])

    await getPostComments(7, "example-test-token")

    const options = vi.mocked(fetch).mock.calls[0][1]
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer example-test-token")
  })

  it("throws the backend message when the post cannot be found", async () => {
    mockFetch(404, async () => ({ detail: "Post not found" }))

    await expect(getPostComments(7)).rejects.toMatchObject({ status: 404, message: "Post not found" })
  })

  it("rejects a response that is not a list of comments", async () => {
    mockFetch(200, async () => ({ unexpected: true }))

    await expect(getPostComments(7)).rejects.toThrow("Unexpected response format")
  })
})

describe("createPostComment", () => {
  it("posts the comment text with the token and returns the saved comment", async () => {
    mockFetch(201, async () => sampleComment)

    const result = await createPostComment(7, "Looks like an amazing trip!", "example-test-token")

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/api/posts/7/comments")
    expect(options?.method).toBe("POST")
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer example-test-token")
    expect(JSON.parse(options?.body as string)).toEqual({ content: "Looks like an amazing trip!" })
    expect(result).toEqual(sampleComment)
  })

  it("formats validation errors from the backend", async () => {
    mockFetch(422, async () => ({ detail: [{ loc: ["body", "content"], msg: "Comment cannot be blank" }] }))

    await expect(createPostComment(7, " ", "token")).rejects.toMatchObject({
      status: 422,
      message: "Comment cannot be blank",
    })
  })

  it("reports an expired login on 401", async () => {
    mockFetch(401, async () => ({ detail: "Invalid authentication token" }))

    await expect(createPostComment(7, "Hi", "stale")).rejects.toMatchObject({
      status: 401,
      message: "Your login has expired. Please log in again.",
    })
  })
})
