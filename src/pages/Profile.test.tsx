import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Profile from "./Profile"
import { authFetch } from "@/auth/authFetch"

vi.mock("@/auth/authFetch", () => ({ authFetch: vi.fn() }))

const mockedAuthFetch = vi.mocked(authFetch)
const DRAFT_KEY = "wetravel_itinerary_drafts_v1"

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )
}

function signIn() {
  localStorage.setItem("access_token", "test-jwt-token")
}

const mockUser = {
  user_id: 9,
  username: "traveler9",
  email: "traveler@example.com",
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function failedResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Profile — Sprint 3 midterm prototype", () => {
  it("PROF-01: displays the authenticated user's information", async () => {
    signIn()
    mockedAuthFetch.mockResolvedValue(okResponse(mockUser))
    renderProfile()

    expect(await screen.findByRole("heading", { name: "traveler9" })).toBeInTheDocument()
    expect(screen.getByText("traveler@example.com")).toBeInTheDocument()
    expect(screen.getByText("User #9")).toBeInTheDocument()
    expect(mockedAuthFetch).toHaveBeenCalledWith("/api/users/me")
  })

  it("PROF-02: displays loading feedback while the user request is pending", () => {
    signIn()
    mockedAuthFetch.mockImplementation(() => new Promise(() => {}))
    renderProfile()

    expect(screen.getByRole("status")).toHaveTextContent("Loading your profile...")
  })

  it("PROF-03: directs signed-out visitors to Login", () => {
    renderProfile()

    expect(screen.getByRole("heading", { name: "Sign in to view your profile" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login")
    expect(mockedAuthFetch).not.toHaveBeenCalled()
  })

  it("PROF-04: displays feedback when loading the profile fails", async () => {
    signIn()
    mockedAuthFetch.mockRejectedValue(new Error("Profile request failed"))
    renderProfile()

    expect(await screen.findByRole("alert")).toHaveTextContent("Profile request failed")
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("PROF-05: retries the profile request after a failure", async () => {
    signIn()
    mockedAuthFetch
      .mockRejectedValueOnce(new Error("Temporary error"))
      .mockResolvedValueOnce(okResponse(mockUser))
    renderProfile()

    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary error")
    fireEvent.click(screen.getByRole("button", { name: /try again/i }))

    expect(await screen.findByRole("heading", { name: "traveler9" })).toBeInTheDocument()
    await waitFor(() => expect(mockedAuthFetch).toHaveBeenCalledTimes(2))
  })

  it("PROF-06: links to Create Post", async () => {
    signIn()
    mockedAuthFetch.mockResolvedValue(okResponse(mockUser))
    renderProfile()

    expect(screen.getByRole("link", { name: /create post/i })).toHaveAttribute("href", "/create-post")
  })

  it("PROF-07: links to the Itinerary page", async () => {
    signIn()
    mockedAuthFetch.mockResolvedValue(okResponse(mockUser))
    renderProfile()

    expect(screen.getByRole("link", { name: /my itineraries/i })).toHaveAttribute("href", "/itinerary")
    expect(screen.getByRole("link", { name: /view itineraries/i })).toHaveAttribute("href", "/itinerary")
  })

  it("PROF-08: displays the count of saved browser itinerary drafts", async () => {
    signIn()
    mockedAuthFetch.mockResolvedValue(okResponse(mockUser))
    localStorage.setItem(DRAFT_KEY, JSON.stringify([
      { id: "trip-1", title: "California weekend", destinations: [] },
      { id: "trip-2", title: "Arizona trip", destinations: [{ id: "stop-1", name: "Sedona", notes: "" }] },
    ]))
    renderProfile()

    const section = screen.getByRole("heading", { name: "Travel planning" }).closest("section")
    expect(section).not.toBeNull()
    expect(section).toHaveTextContent("2")
    expect(section).toHaveTextContent("Itinerary drafts saved in this browser")
  })

  it("PROF-09: displays feedback when the server rejects the profile request", async () => {
    signIn()
    mockedAuthFetch.mockResolvedValue(failedResponse(500))
    renderProfile()

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load current user: 500")
  })
})