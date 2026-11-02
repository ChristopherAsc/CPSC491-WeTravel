import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginUser } from "@/api_configs"
import Login from "@/pages/Login"

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock("@/api_configs", () => ({
  loginUser: vi.fn(),
}))

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ login: loginMock, user: null }),
}))

type Entry = string | { pathname: string; state?: unknown }

function renderLogin(entry: Entry = "/login") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/feed" element={<p>Feed page</p>} />
        <Route path="/profile" element={<p>Profile page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillForm(username: string, password: string) {
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: username },
  })
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole("button", { name: "Login" }))
}

beforeEach(() => {
  vi.resetAllMocks()
  // Login.tsx logs failures; keep the test output clean
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Login page", () => {
  it("logs in and goes to the feed by default", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })
    loginMock.mockResolvedValue(undefined)

    renderLogin()

    fillForm("tester", "password123")

    expect(await screen.findByText("Feed page")).toBeTruthy()
    expect(loginUser).toHaveBeenCalledWith("tester", "password123")
    expect(loginMock).toHaveBeenCalledWith("fake-token")
  })

  it("returns to the page the user was trying to open", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })
    loginMock.mockResolvedValue(undefined)

    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/profile" } },
    })

    fillForm("tester", "password123")

    expect(await screen.findByText("Profile page")).toBeTruthy()
  })

  it("shows the backend message for wrong credentials", async () => {
    vi.mocked(loginUser).mockRejectedValue(
      new Error("Invalid username or password")
    )

    renderLogin()

    fillForm("tester", "wrong-password")

    expect(await screen.findByText("Invalid username or password")).toBeTruthy()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it("shows an error when the current user cannot be loaded", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })
    loginMock.mockRejectedValue(new Error("Failed to load current user: 500"))

    renderLogin()

    fillForm("tester", "password123")

    expect(
      await screen.findByText("Failed to load current user: 500")
    ).toBeTruthy()
    expect(screen.queryByText("Feed page")).toBeNull()
  })

  it("shows an error when the server cannot be reached", async () => {
    vi.mocked(loginUser).mockRejectedValue(new TypeError("Failed to fetch"))

    renderLogin()

    fillForm("tester", "password123")

    expect(await screen.findByText("Failed to fetch")).toBeTruthy()
    expect(screen.queryByText("Feed page")).toBeNull()
  })
})