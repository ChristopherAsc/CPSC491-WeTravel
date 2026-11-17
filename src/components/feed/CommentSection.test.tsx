import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import CommentSection from "./CommentSection"
import { ApiRequestError, createPostComment, getPostComments, type PostComment } from "@/api_configs"
import { onUnauthorized } from "@/auth/authFetch"

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }))

vi.mock("@/api_configs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api_configs")>()),
  getPostComments: vi.fn(),
  createPostComment: vi.fn(),
}))

const existing: PostComment = {
  comment_id: 1,
  post_id: 5,
  user_id: 3,
  username: "wanderer3",
  content: "Beautiful photos!",
  created_at: "2026-11-11T10:00:00Z",
}

const renderSection = (onCommentAdded?: () => void) =>
  render(
    <MemoryRouter>
      <CommentSection postId={5} onCommentAdded={onCommentAdded} />
    </MemoryRouter>
  )

const typeComment = (text: string) =>
  fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: text } })

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ token: "example-test-token", isAuthenticated: true, isLoading: false })
  vi.mocked(getPostComments).mockResolvedValue([existing])
})

afterEach(() => {
  cleanup()
})

describe("CommentSection", () => {
  it("shows a loading message and then the existing comments", async () => {
    renderSection()

    expect(screen.getByText("Loading comments...")).toBeInTheDocument()
    expect(await screen.findByText("Beautiful photos!")).toBeInTheDocument()
    expect(screen.getByText("wanderer3")).toBeInTheDocument()
    expect(getPostComments).toHaveBeenCalledWith(5, "example-test-token")
  })

  it("shows an empty state when there are no comments", async () => {
    vi.mocked(getPostComments).mockResolvedValue([])
    renderSection()

    expect(await screen.findByText(/No comments yet/)).toBeInTheDocument()
  })

  it("shows an error and lets the user retry when comments fail to load", async () => {
    vi.mocked(getPostComments)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce([existing])
    renderSection()

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load comments")

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Beautiful photos!")).toBeInTheDocument()
    expect(getPostComments).toHaveBeenCalledTimes(2)
  })

  it("submits a comment and shows it under the post", async () => {
    const onCommentAdded = vi.fn()
    vi.mocked(createPostComment).mockResolvedValue({
      ...existing,
      comment_id: 2,
      username: "me",
      content: "Looks like an amazing trip!",
    })
    renderSection(onCommentAdded)
    await screen.findByText("Beautiful photos!")

    typeComment("  Looks like an amazing trip!  ")
    fireEvent.click(screen.getByRole("button", { name: "Post" }))

    expect(await screen.findByText("Looks like an amazing trip!")).toBeInTheDocument()
    expect(createPostComment).toHaveBeenCalledWith(5, "Looks like an amazing trip!", "example-test-token")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("")
    expect(screen.getByText("Beautiful photos!")).toBeInTheDocument()
    expect(onCommentAdded).toHaveBeenCalledTimes(1)
  })

  it("replaces the empty state with the first comment", async () => {
    vi.mocked(getPostComments).mockResolvedValue([])
    vi.mocked(createPostComment).mockResolvedValue({ ...existing, content: "First!" })
    renderSection()
    await screen.findByText(/No comments yet/)

    typeComment("First!")
    fireEvent.click(screen.getByRole("button", { name: "Post" }))

    expect(await screen.findByText("First!")).toBeInTheDocument()
    expect(screen.queryByText(/No comments yet/)).not.toBeInTheDocument()
  })

  it("does not allow blank comments", async () => {
    renderSection()
    await screen.findByText("Beautiful photos!")

    const submit = screen.getByRole("button", { name: "Post" })
    expect(submit).toBeDisabled()

    typeComment("    ")
    expect(submit).toBeDisabled()

    typeComment("Hello")
    expect(submit).toBeEnabled()
  })

  it("limits comments to 500 characters", async () => {
    renderSection()
    await screen.findByText("Beautiful photos!")

    expect(screen.getByLabelText("Add a comment")).toHaveAttribute("maxlength", "500")
  })

  it("keeps the draft and shows the message when posting fails", async () => {
    const onCommentAdded = vi.fn()
    vi.mocked(createPostComment).mockRejectedValue(new ApiRequestError("Post not found", 404))
    renderSection(onCommentAdded)
    await screen.findByText("Beautiful photos!")

    typeComment("Hello there")
    fireEvent.click(screen.getByRole("button", { name: "Post" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Post not found")
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Hello there")
    expect(onCommentAdded).not.toHaveBeenCalled()
  })

  it("shows a connection message when the server cannot be reached", async () => {
    vi.mocked(createPostComment).mockRejectedValue(new TypeError("Failed to fetch"))
    renderSection()
    await screen.findByText("Beautiful photos!")

    typeComment("Hello there")
    fireEvent.click(screen.getByRole("button", { name: "Post" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't post your comment")
  })

  it("ends the session when the token has expired", async () => {
    const onExpired = vi.fn()
    const stopListening = onUnauthorized(onExpired)
    vi.mocked(createPostComment).mockRejectedValue(new ApiRequestError("Your login has expired. Please log in again.", 401))
    renderSection()
    await screen.findByText("Beautiful photos!")

    typeComment("Hello there")
    fireEvent.click(screen.getByRole("button", { name: "Post" }))

    await waitFor(() => expect(onExpired).toHaveBeenCalled())
    stopListening()
  })

  it("lets signed-out visitors read comments but asks them to log in to write one", async () => {
    useAuthMock.mockReturnValue({ token: null, isAuthenticated: false, isLoading: false })
    renderSection()

    expect(await screen.findByText("Beautiful photos!")).toBeInTheDocument()
    expect(screen.queryByLabelText("Add a comment")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(getPostComments).toHaveBeenCalledWith(5, null)
  })
})
