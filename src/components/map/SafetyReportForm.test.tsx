import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { SafetyReportForm } from "./SafetyReportForm"

const { createSafetyReportMock } = vi.hoisted(() => ({
  createSafetyReportMock: vi.fn(),
}))

vi.mock("@/api_configs", () => ({
  createSafetyReport: createSafetyReportMock,
}))

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Report Type"), {
    target: { value: "theft" },
  })

  fireEvent.change(screen.getByLabelText("Location"), {
    target: { value: "Yosemite National Park" },
  })

  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: "37.8651" },
  })

  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: "-119.5383" },
  })

  fireEvent.change(screen.getByLabelText("Date and Time"), {
    target: { value: "2026-11-16T15:30" },
  })

  fireEvent.change(screen.getByLabelText("Description"), {
    target: {
      value: "A backpack was stolen near the parking area.",
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Safety Report Form", () => {
  it("renders the safety reporting form", () => {
    render(<SafetyReportForm />)

    expect(
      screen.getByRole("heading", {
        name: "Report a Safety Issue",
      })
    ).toBeInTheDocument()

    expect(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    ).toBeInTheDocument()
  })

  it("validates required fields", async () => {
    render(<SafetyReportForm />)

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    )

    expect(
      await screen.findByText("Report type is required")
    ).toBeInTheDocument()

    expect(
      screen.getByText("Location is required")
    ).toBeInTheDocument()

    expect(
      screen.getByText("Latitude is required")
    ).toBeInTheDocument()

    expect(
      screen.getByText("Longitude is required")
    ).toBeInTheDocument()

    expect(
      screen.getByText("Date and time are required")
    ).toBeInTheDocument()

    expect(createSafetyReportMock).not.toHaveBeenCalled()
  })

  it("submits a valid safety report", async () => {
    createSafetyReportMock.mockResolvedValue({
      report_id: 2,
    })

    render(<SafetyReportForm />)
    fillValidForm()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    )

    await waitFor(() => {
      expect(createSafetyReportMock).toHaveBeenCalledWith({
        report_type: "theft",
        description:
          "A backpack was stolen near the parking area.",
        location: {
          name: "Yosemite National Park",
          latitude: 37.8651,
          longitude: -119.5383,
        },
      })
    })

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      "Safety report submitted successfully!"
    )
  })

  it("calls onSuccess after a successful submission", async () => {
    createSafetyReportMock.mockResolvedValue({
      report_id: 3,
    })

    const onSuccess = vi.fn()

    render(<SafetyReportForm onSuccess={onSuccess} />)
    fillValidForm()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    )

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it("displays an error when the API request fails", async () => {
    createSafetyReportMock.mockRejectedValue(
      new Error("Authentication required")
    )

    render(<SafetyReportForm />)
    fillValidForm()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    )

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Authentication required")
  })

  it("rejects invalid latitude", async () => {
    render(<SafetyReportForm />)
    fillValidForm()

    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "100" },
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Submit Report",
      })
    )

    expect(
      await screen.findByText(
        "Latitude must be between -90 and 90"
      )
    ).toBeInTheDocument()

    expect(createSafetyReportMock).not.toHaveBeenCalled()
  })
})
