import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ProtectedRoute from "@/auth/ProtectedRoute"

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock("@/auth/useAuth", () => ({
  useAuth: useAuthMock,
}))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />

        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<p>Profile page</p>} />
        </Route>
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

describe("ProtectedRoute", () => {
  it("redirects guests to the login page", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false })

    renderAt("/profile")

    expect(screen.getByText("Login page")).toBeTruthy()
    expect(screen.queryByText("Profile page")).toBeNull()
  })

  it("waits while a saved session is being verified", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: true })

    renderAt("/profile")

    expect(screen.getByText("Checking your session...")).toBeTruthy()
    expect(screen.queryByText("Profile page")).toBeNull()
    expect(screen.queryByText("Login page")).toBeNull()
  })

  it("shows the page to an authenticated user", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false })

    renderAt("/profile")

    expect(screen.getByText("Profile page")).toBeTruthy()
    expect(screen.queryByText("Login page")).toBeNull()
  })
})
