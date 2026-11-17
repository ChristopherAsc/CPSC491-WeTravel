import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Navbar from "./Navbar"
import { useAuth } from "@/auth/useAuth"

vi.mock("@/auth/useAuth", () => ({
  useAuth: vi.fn(),
}))

// Search behavior has separate tests; these tests cover navbar visibility.
vi.mock("@/components/social/TravelerSearchBar", () => ({
  default: () => <div data-testid="traveler-search">Traveler Search</div>,
}))

const mockLogout = vi.fn()
const mockLogin = vi.fn()
const mockedUseAuth = vi.mocked(useAuth)

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/feed"]}>
      <Navbar />
    </MemoryRouter>,
  )
}

function mockAuthenticatedUser() {
  mockedUseAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    token: "mock-test-token",
    login: mockLogin,
    user: {
      user_id: 1,
      username: "testtraveler",
      email: "test@example.com",
    },
    logout: mockLogout,
  })
}

function mockGuestUser() {
  mockedUseAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    token: null,
    login: mockLogin,
    user: null,
    logout: mockLogout,
  })
}

describe("Navbar — Feature #4 Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
  })

  // This project's Vitest setup does not automatically clean up rendered roots.
  // Without explicit cleanup, prior navbar instances remain in the DOM.
  afterEach(() => {
    cleanup()
  })

  it("NAV-01: displays the main navigation links", () => {
    renderNavbar()

    for (const name of ["Feed", "Map", "Create Post", "Itinerary", "Profile"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
  })

  it("NAV-02: displays the authenticated username", () => {
    renderNavbar()
    expect(screen.getAllByText("testtraveler").length).toBeGreaterThan(0)
  })

  it("NAV-03: displays the traveler search bar for authenticated users", () => {
    renderNavbar()
    expect(screen.getAllByTestId("traveler-search").length).toBeGreaterThan(0)
  })

  it("NAV-04: displays account settings links for authenticated users", () => {
    renderNavbar()

    const settingsLinks = screen.getAllByRole("link", { name: "Account Settings" })
    expect(settingsLinks.length).toBeGreaterThan(0)
    for (const link of settingsLinks) {
      expect(link).toHaveAttribute("href", "/settings")
    }
  })

  it("NAV-05: displays Login and Register for guests", () => {
    mockGuestUser()
    renderNavbar()

    expect(screen.getAllByRole("link", { name: /login/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: /register/i }).length).toBeGreaterThan(0)
  })

  it("NAV-06: hides search and settings for guests", () => {
    mockGuestUser()
    renderNavbar()

    expect(screen.queryByTestId("traveler-search")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Account Settings" })).not.toBeInTheDocument()
  })

  it("NAV-07: logs out when Logout is clicked", () => {
    renderNavbar()

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i })
    fireEvent.click(logoutButtons[0])
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it("NAV-08: hides authentication controls while loading", () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      token: null,
      login: mockLogin,
      user: null,
      logout: mockLogout,
    })

    renderNavbar()

    expect(screen.queryByTestId("traveler-search")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /login/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Account Settings" })).not.toBeInTheDocument()
  })
})
