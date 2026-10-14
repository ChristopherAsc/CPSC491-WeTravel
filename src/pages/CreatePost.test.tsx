import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import CreatePost from "./CreatePost"

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }))

const signIn = () => useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false })

const renderPage = () => render(<MemoryRouter><CreatePost /></MemoryRouter>)
const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/caption/i), { target: { value: "Wonderful views in Yosemite" } })
  fireEvent.change(screen.getByLabelText(/place name/i), { target: { value: "Yosemite" } })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // Signed out by default; tests call signIn() to simulate a logged-in user
  useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-photo"),
    revokeObjectURL: vi.fn(),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Create Post", () => {
  it("displays the form and requires signing in to publish", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Create a travel post" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("You must be signed in")
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("button", { name: /publish post/i })).toBeDisabled()
  })

  it("keeps publishing disabled while the saved session is being verified", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: true })
    renderPage()
    expect(screen.queryByText(/you must be signed in/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /publish post/i })).toBeDisabled()
  })

  it("validates an empty caption and location", async () => {
    signIn()
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /publish post/i }))
    expect(await screen.findByText("Caption is required")).toBeInTheDocument()
    expect(screen.getByText("Location name is required")).toBeInTheDocument()
  })

  it("shows an image preview and allows removing it", async () => {
    signIn()
    renderPage()
    const image = new File(["image bytes"], "vacation.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("Upload travel photo"), { target: { files: [image] } })
    expect(await screen.findByAltText("Selected travel photo preview")).toHaveAttribute("src", "blob:mock-photo")
    expect(screen.getByText("vacation.png")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /remove photo/i }))
    expect(screen.queryByAltText("Selected travel photo preview")).not.toBeInTheDocument()
  })

  it("rejects unsupported image types", async () => {
    signIn()
    renderPage()
    const file = new File(["text"], "notes.txt", { type: "text/plain" })
    fireEvent.change(screen.getByLabelText("Upload travel photo"), { target: { files: [file] } })
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPG, PNG, or WebP image.")
    expect(screen.queryByAltText("Selected travel photo preview")).not.toBeInTheDocument()
  })

  it("blocks publishing until location lookup is connected", async () => {
    signIn()
    renderPage()
    fillRequiredFields()
    fireEvent.click(screen.getByRole("button", { name: /publish post/i }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Location lookup is not connected yet")
    })
    expect(screen.getByRole("alert")).toHaveTextContent("Yosemite")
  })
})