import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Navbar from "@/components/layout/Navbar"

const { useAuthMock, logoutMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  logoutMock: vi.fn(),
}))

vi.mock("@/auth/useAuth", () => ({
  useAuth: useAuthMock,
}))

const testUser = {
  user_id: 1,
  username: "tester",
  email: "tester@example.com",
}

function renderNavbar() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Navbar />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
})

// The Navbar renders a desktop and a mobile version, so controls appear twice.
describe("Navbar auth controls", () => {
  it("shows Login and Register to guests", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      logout: logoutMock,
    })

    renderNavbar()

    expect(screen.getAllByText("Login").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Register").length).toBeGreaterThan(0)
    expect(screen.queryAllByText("Logout")).toHaveLength(0)
  })

  it("shows the username and Logout to a signed-in user", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: testUser,
      logout: logoutMock,
    })

    renderNavbar()

    expect(screen.getAllByText("tester").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Logout").length).toBeGreaterThan(0)
    expect(screen.queryAllByText("Login")).toHaveLength(0)
    expect(screen.queryAllByText("Register")).toHaveLength(0)
  })

  it("logs out and goes to the login page", async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: testUser,
      logout: logoutMock,
    })

    renderNavbar()

    fireEvent.click(screen.getAllByText("Logout")[0])

    expect(logoutMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Login page")).toBeTruthy()
  })

  it("hides the controls while a saved session is being verified", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
      user: null,
      logout: logoutMock,
    })

    renderNavbar()

    expect(screen.queryAllByText("Login")).toHaveLength(0)
    expect(screen.queryAllByText("Logout")).toHaveLength(0)
  })
})
