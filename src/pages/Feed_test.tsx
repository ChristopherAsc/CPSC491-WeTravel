import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Feed from "./Feed"
import { getPosts } from "@/api_configs"

vi.mock("@/api_configs", () => ({ getPosts: vi.fn() }))
const mockedGetPosts = vi.mocked(getPosts)
const renderFeed = () => render(<MemoryRouter><Feed /></MemoryRouter>)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe("Feed", () => {
  it("shows posts and their metadata from the API", async () => {
    mockedGetPosts.mockResolvedValue([{ post_id: 1, user_id: 9, caption: "A memorable trip", media_url: "https://example.com/photo.jpg", location: { name: "Yosemite", latitude: 37.8, longitude: -119.5 }, created_at: "2026-10-10T10:00:00Z" }])
    renderFeed()
    expect(screen.getByText("Loading travel posts...")).toBeInTheDocument()
    expect(await screen.findByText("A memorable trip")).toBeInTheDocument()
    expect(screen.getByText("Traveler #9")).toBeInTheDocument()
    expect(screen.getAllByText("Yosemite")).toHaveLength(2)
    expect(screen.getByAltText("Travel photo for Yosemite")).toBeInTheDocument()
  })

  it("shows an empty state", async () => {
    mockedGetPosts.mockResolvedValue([])
    renderFeed()
    expect(await screen.findByText("No travel posts yet")).toBeInTheDocument()
  })

  it("shows an error if the API fails", async () => {
    mockedGetPosts.mockRejectedValue(new Error("network error"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    renderFeed()
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load travel posts")
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("allows retrying after a failure", async () => {
    mockedGetPosts.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce([])
    vi.spyOn(console, "error").mockImplementation(() => {})
    renderFeed()
    await screen.findByRole("alert")
    screen.getByRole("button", { name: /try again/i }).click()
    await waitFor(() => expect(screen.getByText("No travel posts yet")).toBeInTheDocument())
  })
})
