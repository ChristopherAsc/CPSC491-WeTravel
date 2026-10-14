import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginUser, registerUser } from "@/api_configs"
import Register from "@/pages/Register"

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock("@/api_configs", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
}))

vi.mock("@/auth/useAuth", () => ({
  useAuth: () => ({ login: loginMock }),
}))

function fillForm(password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "tester@example.com" },
  })
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "tester" },
  })
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmPassword },
  })
  fireEvent.click(screen.getByRole("button", { name: "Register" }))
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
})

describe("Register page", () => {
  it("blocks submit when passwords do not match", async () => {
    render(<Register />)

    fillForm("password123", "password456")

    expect(await screen.findByText("Passwords do not match")).toBeTruthy()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it("registers, logs in, and hands the token to the auth state", async () => {
    vi.mocked(registerUser).mockResolvedValue({ message: "ok", user_id: 1 })
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })
    loginMock.mockResolvedValue(undefined)

    render(<Register />)

    fillForm("password123", "password123")

    expect(
      await screen.findByText("Account created. Logged in as tester")
    ).toBeTruthy()
    expect(registerUser).toHaveBeenCalledWith(
      "tester@example.com",
      "tester",
      "password123"
    )
    expect(loginUser).toHaveBeenCalledWith("tester", "password123")
    expect(loginMock).toHaveBeenCalledWith("fake-token")
  })

  it("shows the backend error and skips login when register fails", async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new Error("Username is already taken")
    )

    render(<Register />)

    fillForm("password123", "password123")

    expect(await screen.findByText("Username is already taken")).toBeTruthy()
    expect(loginUser).not.toHaveBeenCalled()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it("tells the user when register works but automatic login fails", async () => {
    vi.mocked(registerUser).mockResolvedValue({ message: "ok", user_id: 1 })
    vi.mocked(loginUser).mockRejectedValue(new Error("Login failed: 500"))

    render(<Register />)

    fillForm("password123", "password123")

    expect(
      await screen.findByText(
        "Account created, but automatic login failed: Login failed: 500"
      )
    ).toBeTruthy()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it("tells the user when the auth state cannot load the new user", async () => {
    vi.mocked(registerUser).mockResolvedValue({ message: "ok", user_id: 1 })
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })
    loginMock.mockRejectedValue(new Error("Failed to load current user: 500"))

    render(<Register />)

    fillForm("password123", "password123")

    expect(
      await screen.findByText(
        "Account created, but automatic login failed: Failed to load current user: 500"
      )
    ).toBeTruthy()
  })
})