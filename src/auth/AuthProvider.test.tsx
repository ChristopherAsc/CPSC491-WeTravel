import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getCurrentUser } from "@/api_configs"
import { AuthProvider } from "@/auth/AuthProvider"
import { authFetch } from "@/auth/authFetch"
import { getToken, setToken } from "@/auth/tokenStorage"
import { useAuth } from "@/auth/useAuth"

vi.mock("@/api_configs", () => ({
  API_BASE_URL: "http://test",
  getCurrentUser: vi.fn(),
}))

const testUser = {
  user_id: 1,
  username: "tester",
  email: "tester@example.com",
}

function Probe() {
  const { user, isAuthenticated, login, logout } = useAuth()

  return (
    <div>
      <p>{isAuthenticated ? `user:${user?.username ?? "none"}` : "anonymous"}</p>

      <button
        onClick={() => {
          login("new-token").catch(() => {})
        }}
      >
        do-login
      </button>

      <button onClick={logout}>do-logout</button>
    </div>
  )
}

function renderProvider() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("AuthProvider", () => {
  it("starts logged out when there is no saved token", () => {
    renderProvider()

    expect(screen.getByText("anonymous")).toBeTruthy()
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it("restores the session from a saved token", async () => {
    setToken("saved-token")
    vi.mocked(getCurrentUser).mockResolvedValue(testUser)

    renderProvider()

    expect(await screen.findByText("user:tester")).toBeTruthy()
    expect(getCurrentUser).toHaveBeenCalledWith("saved-token")
  })

  it("clears a saved token that the backend rejects", async () => {
    setToken("bad-token")
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("Failed to load current user: 401")
    )

    renderProvider()

    expect(await screen.findByText("anonymous")).toBeTruthy()
    expect(getToken()).toBeNull()
  })

  it("login stores the token and loads the user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(testUser)

    renderProvider()

    fireEvent.click(screen.getByText("do-login"))

    expect(await screen.findByText("user:tester")).toBeTruthy()
    expect(getToken()).toBe("new-token")
  })

  it("login clears the token when the user cannot be loaded", async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("Failed to load current user: 500")
    )

    renderProvider()

    fireEvent.click(screen.getByText("do-login"))

    await waitFor(() => expect(getToken()).toBeNull())
    expect(screen.getByText("anonymous")).toBeTruthy()
  })

  it("logout clears the token and the user", async () => {
    setToken("saved-token")
    vi.mocked(getCurrentUser).mockResolvedValue(testUser)

    renderProvider()

    expect(await screen.findByText("user:tester")).toBeTruthy()

    fireEvent.click(screen.getByText("do-logout"))

    expect(await screen.findByText("anonymous")).toBeTruthy()
    expect(getToken()).toBeNull()
  })

  it("ends the session when authFetch gets a 401", async () => {
    setToken("saved-token")
    vi.mocked(getCurrentUser).mockResolvedValue(testUser)

    renderProvider()

    expect(await screen.findByText("user:tester")).toBeTruthy()

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    )

    await act(async () => {
      await authFetch("/api/posts")
    })

    expect(await screen.findByText("anonymous")).toBeTruthy()
    expect(getToken()).toBeNull()
  })
})
