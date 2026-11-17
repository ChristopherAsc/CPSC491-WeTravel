import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import TravelerProfile from "./TravelerProfile"
import { socialRequest } from "@/socialApi"

const mockUser = vi.hoisted(() => ({ current: { user_id: 1, username: "alpha" } }))
vi.mock("@/socialApi", () => ({ socialRequest: vi.fn() }))
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: mockUser.current }) }))
const request = vi.mocked(socialRequest)
const alpha = { user_id: 1, username: "alpha" }
const beta = { user_id: 2, username: "beta" }
const pending = { request_id: 10, sender: alpha, recipient: beta, status: "pending" }
const accepted = { ...pending, status: "accepted" }
const samplePost = { post_id: 41, user_id: 2, caption: "A great day in Yosemite", media_url: null, created_at: "2026-11-15T09:00:00", location: { name: "Yosemite", latitude: 37.7, longitude: -119.6 } }

function mount(id = 2) {
  render(<MemoryRouter initialEntries={[`/travelers/${id}`]}>
    <Routes><Route path="/travelers/:userId" element={<TravelerProfile />} /></Routes>
  </MemoryRouter>)
}

beforeEach(() => { vi.resetAllMocks(); mockUser.current = { user_id: 1, username: "alpha" } })
afterEach(() => cleanup())

describe("Traveler public profile", () => {
  it("loads and displays posts authored by the selected traveler", async () => {
    request.mockImplementation(async path => {
      if (path === "/users/2") return beta
      if (path === "/friends/requests") return []
      if (path === "/users/2/posts") return [samplePost]
      return null
    })
    mount()
    expect(await screen.findByText("A great day in Yosemite")).toBeInTheDocument()
    expect(screen.getByText("Yosemite")).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith("/users/2/posts")
  })

  it("shows Add Friend on another profile and then pending", async () => {
    let sent = false
    request.mockImplementation(async (path, method) => {
      if (path === "/users/2") return beta
      if (path === "/friends/requests") return sent ? [pending] : []
      if (path === "/users/2/posts") return []
      if (path === "/friends/requests/2" && method === "POST") { sent = true; return pending }
      return null
    })
    mount()
    fireEvent.click(await screen.findByRole("button", { name: "Add Friend" }))
    await waitFor(() => expect(request).toHaveBeenCalledWith("/friends/requests/2", "POST"))
    expect(await screen.findByText("Request Pending")).toBeInTheDocument()
  })

  it("lets recipient accept an incoming request", async () => {
    mockUser.current = { user_id: 2, username: "beta" }
    let didAccept = false
    request.mockImplementation(async (path, method) => {
      if (path === "/users/1") return alpha
      if (path === "/friends/requests") return [didAccept ? accepted : pending]
      if (path === "/users/1/posts") return []
      if (path === "/friends/requests/10?decision=accept" && method === "PATCH") { didAccept = true; return accepted }
      return null
    })
    mount(1)
    fireEvent.click(await screen.findByRole("button", { name: "Accept Request" }))
    await waitFor(() => expect(request).toHaveBeenCalledWith("/friends/requests/10?decision=accept", "PATCH"))
    expect(await screen.findByText("Friends")).toBeInTheDocument()
  })

  it("does not permit adding yourself", async () => {
    request.mockImplementation(async path => path === "/users/1" ? alpha : [])
    mount(1)
    await screen.findByText("WeTravel community member")
    expect(screen.queryByRole("button", { name: "Add Friend" })).not.toBeInTheDocument()
  })
})

describe("private traveler posts", () => {
  it("shows a privacy notice instead of posts to a non-friend", async () => {
    request.mockImplementation(async path => {
      if (path === "/users/2") return beta
      if (path === "/friends/requests") return []
      if (path === "/users/2/posts") throw Error("This profile is private")
      return null
    })
    mount()
    expect(await screen.findByText("This profile is private")).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith("/users/2/posts")
    expect(screen.getByRole("button", { name: "Add Friend" })).toBeInTheDocument()
  })

  it("allows accepted friends to view private traveler posts", async () => {
    request.mockImplementation(async path => {
      if (path === "/users/2") return beta
      if (path === "/friends/requests") return [accepted]
      if (path === "/users/2/posts") return [samplePost]
      return null
    })
    mount()
    expect(await screen.findByText("A great day in Yosemite")).toBeInTheDocument()
    expect(screen.queryByText("This profile is private")).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledWith("/users/2/posts")
  })

  it("does not allow a pending request to view private posts", async () => {
    request.mockImplementation(async path => {
      if (path === "/users/2") return beta
      if (path === "/friends/requests") return [pending]
      if (path === "/users/2/posts") throw Error("This profile is private")
      return null
    })
    mount()
    expect(await screen.findByText("This profile is private")).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith("/users/2/posts")
  })
})
