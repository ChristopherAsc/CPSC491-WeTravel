import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Home from "./Home"

describe("Home page", () => {
  it("renders the landing page heading", () => {
    render(<Home />)

    expect(
      screen.getByRole("heading", { name: /home landing page/i })
    ).toBeInTheDocument()
  })
})