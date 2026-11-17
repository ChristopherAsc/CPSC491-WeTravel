import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Friends from "./Friends"
import { socialRequest } from "@/socialApi"

vi.mock("@/socialApi", () => ({ socialRequest: vi.fn() }))
vi.mock("@/auth/useAuth", () => ({ useAuth: () => ({ user: { user_id: 1, username: "alpha" } }) }))
const request = vi.mocked(socialRequest)
const alpha = { user_id: 1, username: "alpha" }
const beta = { user_id: 2, username: "beta" }

beforeEach(() => {
  vi.resetAllMocks()
  request.mockImplementation(async path => path === "/friends/requests" ? [{ request_id: 20, sender: beta, recipient: alpha, status: "pending" }] : [beta])
})
afterEach(() => cleanup())

describe("Friends management page", () => {
  it("shows incoming invitations and established friends in distinct sections", async () => {
    render(<MemoryRouter><Friends /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Friend requests" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Your friends" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Sent requests" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })
})
