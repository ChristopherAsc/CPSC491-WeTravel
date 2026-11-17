import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AccountSettings from "./AccountSettings"
import TravelerSearch from "./TravelerSearch"
import { socialRequest } from "@/socialApi"

vi.mock("@/socialApi", () => ({ socialRequest: vi.fn() }))
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ logout: vi.fn(), user: { user_id: 1, username: "alpha" } }) }))
const mockApi = vi.mocked(socialRequest)

beforeEach(() => vi.resetAllMocks())
afterEach(() => cleanup())

describe("Feature #4 frontend regression", () => {
  it("F4-UI-01: loads settings and persists edited username through API", async () => {
    mockApi.mockResolvedValueOnce({ user_id: 1, username: "alpha", email: "a@example.com" })
      .mockResolvedValueOnce({ user_id: 1, username: "alpha_updated" })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    const field = await screen.findByLabelText("Username")
    expect(field).toHaveValue("alpha")
    fireEvent.change(field, { target: { value: "alpha_updated" } })
    fireEvent.click(screen.getByRole("button", { name: "Save username" }))
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith("/users/me", "PATCH", { username: "alpha_updated" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Username updated")
  })

  it("F4-UI-02: displays conflict error from backend", async () => {
    mockApi.mockResolvedValueOnce({ user_id: 1, username: "alpha", email: "a@example.com" })
      .mockRejectedValueOnce(new Error("Username is already taken"))
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await screen.findByDisplayValue("alpha")
    fireEvent.click(screen.getByRole("button", { name: "Save username" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Username is already taken")
  })

  it("F4-UI-03: searches and opens matching public profile", async () => {
    mockApi.mockResolvedValueOnce([{ user_id: 9, username: "traveler_b" }])
    render(<MemoryRouter><TravelerSearch /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText("Search usernames"), { target: { value: "travel" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByRole("link", { name: "traveler_b" })).toHaveAttribute("href", "/travelers/9")
    expect(mockApi).toHaveBeenCalledWith("/users/search?username=travel")
  })

  it("F4-UI-04: shows empty search message", async () => {
    mockApi.mockResolvedValueOnce([])
    render(<MemoryRouter><TravelerSearch /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText("Search usernames"), { target: { value: "nobody" } })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByRole("status")).toHaveTextContent("No users found")
  })
})
