
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { healthCheck } from "@/api_configs"
import Home from "./Home"

vi.mock("@/api_configs", () => ({
  healthCheck: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(healthCheck).mockResolvedValue({
    status: "healthy",
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("Home page - Sprint 4 MVP Regression", () => {
  it("renders the landing page without a live backend", async () => {
    render(<Home />)

    expect(
      screen.getByRole("heading", { name: /home landing page/i })
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(healthCheck).toHaveBeenCalled()
    })
  })
})
