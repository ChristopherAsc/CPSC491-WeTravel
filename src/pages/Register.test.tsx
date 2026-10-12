import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginUser, registerUser } from "@/api_configs"
import Register from "@/pages/Register"

vi.mock("@/api_configs", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
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
  localStorage.clear()
  vi.clearAllMocks()
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

  it("registers, logs in, and stores the token", async () => {
    vi.mocked(registerUser).mockResolvedValue({ message: "ok", user_id: 1 })
    vi.mocked(loginUser).mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    })

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
    expect(localStorage.getItem("access_token")).toBe("fake-token")
  })

  it("shows the backend error and skips login when register fails", async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new Error("Username is already taken")
    )

    render(<Register />)

    fillForm("password123", "password123")

    expect(await screen.findByText("Username is already taken")).toBeTruthy()
    expect(loginUser).not.toHaveBeenCalled()
    expect(localStorage.getItem("access_token")).toBeNull()
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
  })
})
