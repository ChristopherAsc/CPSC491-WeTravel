import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Profile from "@/pages/Profile"

const { useAuthMock, authFetchMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  authFetchMock: vi.fn(),
}))

vi.mock("@/auth/useAuth", () => ({
  useAuth: useAuthMock,
}))

vi.mock("@/auth/authFetch", () => ({
  authFetch: authFetchMock,
}))

const testUser = {
  user_id: 1,
  username: "tester",
  email: "tester@example.com",
}

function mockPosts(status: number, body: unknown = []) {
  authFetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthMock.mockReturnValue({ user: testUser })
})

afterEach(() => {
  cleanup()
})

describe("Profile page", () => {
  it("shows the signed-in user and their posts", async () => {
    mockPosts(200, [
      {
        post_id: 1,
        caption: "Yosemite trip",
        location: { name: "Yosemite National Park" },
      },
    ])

    render(<Profile />)

    expect(screen.getByText("Username: tester")).toBeTruthy()
    expect(screen.getByText("Email: tester@example.com")).toBeTruthy()
    expect(await screen.findByText("Yosemite trip")).toBeTruthy()
    expect(authFetchMock).toHaveBeenCalledWith("/api/users/me/posts")
  })

  it("tells the user when there are no posts yet", async () => {
    mockPosts(200, [])

    render(<Profile />)

    expect(await screen.findByText("You have not posted anything yet.")).toBeTruthy()
  })

  it("shows an error when the server returns 500", async () => {
    mockPosts(500)

    render(<Profile />)

    expect(
      await screen.findByText("Failed to load your posts (500)")
    ).toBeTruthy()
  })

  it("shows an error when the server cannot be reached", async () => {
    authFetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    render(<Profile />)

    expect(
      await screen.findByText("Cannot reach the server. Please try again.")
    ).toBeTruthy()
  })

  it("handles a missing user without crashing", async () => {
    useAuthMock.mockReturnValue({ user: null })
    mockPosts(200, [])

    render(<Profile />)

    expect(
      screen.getByText(
        "Your account details are not available right now. Please try again later."
      )
    ).toBeTruthy()
    expect(await screen.findByText("You have not posted anything yet.")).toBeTruthy()
  })
})
