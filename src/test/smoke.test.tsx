/**
 * Midterm Smoke Test Suite (Sprint 3) - frontend half.
 *
 * Shallow, critical-path checks for Authentication, Feed, Create Post,
 * Map, and Safety availability. Not exhaustive - see each page's own
 * *.test.tsx for deeper coverage. Run with: npm run test -- src/test/smoke.test.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { loginUser, getPosts } from "@/api_configs"
import App from "@/App"
import { AuthProvider } from "@/auth/AuthProvider"
import Login from "@/pages/Login"
import Feed from "@/pages/Feed"
import CreatePost from "@/pages/CreatePost"
import MapPage from "@/pages/MapPage"

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock("@/api_configs", () => ({
  loginUser: vi.fn(),
  getPosts: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({ status: "healthy" }),
}))

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ login: loginMock, user: null }),
}))

vi.mock("mapbox-gl", () => ({
  default: {
    Map: class MockMap {
      on = vi.fn()
      remove = vi.fn()
    },
    accessToken: "",
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Smoke: Application", () => {
  it("loads the app shell and critical navigation without crashing", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole("link", { name: "WeTravel" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Home Landing Page" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Feed" }).length).toBeGreaterThan(0)
  })
})

describe("Smoke: Authentication", () => {
  it("logs a user in successfully", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "smoke-token",
      token_type: "bearer",
    })
    loginMock.mockResolvedValue(undefined)

    render(<Login />)

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "smoke_user" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmokeTest123!" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    expect(await screen.findByText("Logged in as smoke_user")).toBeInTheDocument()
  })
})

describe("Smoke: Feed", () => {
  it("loads and displays existing posts", async () => {
    vi.mocked(getPosts).mockResolvedValue([
      {
        post_id: 1,
        user_id: 9,
        caption: "Smoke test post",
        media_url: "https://example.com/photo.jpg",
        location: { name: "Yosemite", latitude: 37.8, longitude: -119.5 },
        created_at: "2026-10-10T10:00:00Z",
      },
    ])

    render(
      <MemoryRouter>
        <Feed />
      </MemoryRouter>
    )

    expect(await screen.findByText("Smoke test post")).toBeInTheDocument()
  })
})

describe("Smoke: Create Post", () => {
  it("renders the create post form for a signed-in user", () => {
    localStorage.setItem("access_token", "smoke-token")

    render(
      <MemoryRouter>
        <CreatePost />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", { name: "Create a travel post" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/caption/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /publish post/i })).toBeEnabled()
  })
})

describe("Smoke: Map", () => {
  it("renders without a critical failure", () => {
    render(<MapPage />)

    expect(
      screen.getByRole("heading", { name: "Travel Map" })
    ).toBeInTheDocument()
  })
})

describe("Smoke: Safety", () => {
  it("exposes the safety report form", () => {
    render(<MapPage />)

    expect(
      screen.getByRole("heading", { name: "Report a Safety Issue" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Report Type")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /submit report/i })).toBeInTheDocument()
  })
})
