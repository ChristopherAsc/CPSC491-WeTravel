import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TravelerSearchBar from "./TravelerSearchBar"
import { socialRequest } from "@/socialApi"

vi.mock("@/socialApi", () => ({ socialRequest: vi.fn() }))
const mockRequest = vi.mocked(socialRequest)

beforeEach(() => vi.resetAllMocks())
afterEach(() => cleanup())

function mount() {
  return render(<MemoryRouter initialEntries={["/feed"]}>
    <TravelerSearchBar />
    <Routes><Route path="/travelers/:userId" element={<div>Public profile opened</div>} /></Routes>
  </MemoryRouter>)
}

describe("Navbar traveler discovery", () => {
  it("shows username and profile-avatar fallback in the dropdown and opens profile", async () => {
    mockRequest.mockResolvedValue([{ user_id: 8, username: "alextraveler" }])
    mount()
    fireEvent.focus(screen.getByRole("combobox", { name: "Search travelers" }))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "alex" } })
    expect(await screen.findByRole("option", { name: /alextraveler/i })).toBeTruthy()
    expect(mockRequest).toHaveBeenCalledWith("/users/search?username=alex")
    fireEvent.click(screen.getByRole("option", { name: /alextraveler/i }))
    expect(await screen.findByText("Public profile opened")).toBeTruthy()
  })

  it("shows a clear empty-state message", async () => {
    mockRequest.mockResolvedValue([])
    mount()
    fireEvent.focus(screen.getByRole("combobox"))
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "no_such_user_491" } })
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No users found"))
  })
})
