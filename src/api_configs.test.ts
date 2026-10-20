import { afterEach, describe, expect, it, vi } from "vitest"

import { loginUser, registerUser } from "@/api_configs"

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
