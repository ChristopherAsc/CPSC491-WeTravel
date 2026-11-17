import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import PostCard, { type FeedPost } from "./PostCard"
import { ApiRequestError, togglePostLike } from "@/api_configs"
import { onUnauthorized } from "@/auth/authFetch"

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }))

vi.mock("@/api_configs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api_configs")>()),
  togglePostLike: vi.fn(),
}))

const post: FeedPost = {
  post_id: 5,
  user_id: 2,
  username: "wanderer2",
  caption: "Exploring San Diego!",
  media_url: null,
  location: { name: "San Diego, California", latitude: 32.7, longitude: -117.2 },
  created_at: "2026-11-10T10:00:00Z",
  like_count: 2,
  liked_by_me: false,
}

const renderCard = (overrides: Partial<FeedPost> = {}) =>
  render(
    <MemoryRouter>
      <PostCard post={{ ...post, ...overrides }} />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ token: "example-test-token", isAuthenticated: true, isLoading: false })
})

afterEach(() => {
  cleanup()
})

describe("PostCard likes", () => {
  it("shows the current like count and an unliked heart", () => {
    renderCard()

    const button = screen.getByRole("button", { name: "Like this post" })
    expect(button).toHaveAttribute("aria-pressed", "false")
    expect(button).toHaveTextContent("2")
  })

  it("shows a post the user already liked as liked", () => {
    renderCard({ liked_by_me: true, like_count: 4 })

    const button = screen.getByRole("button", { name: "Unlike this post" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("4")
  })

  it("likes the post and shows the updated count", async () => {
    vi.mocked(togglePostLike).mockResolvedValue({ post_id: 5, liked: true, like_count: 3 })
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }))

    const button = await screen.findByRole("button", { name: "Unlike this post" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveTextContent("3")
    expect(togglePostLike).toHaveBeenCalledWith(5, "example-test-token")
  })

  it("removes the like when an already liked post is clicked", async () => {
    vi.mocked(togglePostLike).mockResolvedValue({ post_id: 5, liked: false, like_count: 1 })
    renderCard({ liked_by_me: true, like_count: 2 })

    fireEvent.click(screen.getByRole("button", { name: "Unlike this post" }))

    const button = await screen.findByRole("button", { name: "Like this post" })
    expect(button).toHaveTextContent("1")
  })

  it("asks signed-out visitors to log in instead of calling the API", () => {
    useAuthMock.mockReturnValue({ token: null, isAuthenticated: false, isLoading: false })
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Log in to like posts.")
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(togglePostLike).not.toHaveBeenCalled()
  })

  it("keeps the count unchanged and shows the error when the request fails", async () => {
    vi.mocked(togglePostLike).mockRejectedValue(new ApiRequestError("Post not found", 404))
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Post not found")
    expect(screen.getByRole("button", { name: "Like this post" })).toHaveTextContent("2")
  })

  it("shows a connection message when the server cannot be reached", async () => {
    vi.mocked(togglePostLike).mockRejectedValue(new TypeError("Failed to fetch"))
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update your like")
  })

  it("ends the session when the token has expired", async () => {
    const onExpired = vi.fn()
    const stopListening = onUnauthorized(onExpired)
    vi.mocked(togglePostLike).mockRejectedValue(new ApiRequestError("Your login has expired. Please log in again.", 401))
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Like this post" }))

    await waitFor(() => expect(onExpired).toHaveBeenCalled())
    stopListening()
  })

  it("ignores repeat clicks while a like is being saved", async () => {
    let finish: (value: { post_id: number; liked: boolean; like_count: number }) => void = () => {}
    vi.mocked(togglePostLike).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderCard()

    const button = screen.getByRole("button", { name: "Like this post" })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(togglePostLike).toHaveBeenCalledTimes(1)
    finish({ post_id: 5, liked: true, like_count: 3 })
    await screen.findByRole("button", { name: "Unlike this post" })
  })
})
