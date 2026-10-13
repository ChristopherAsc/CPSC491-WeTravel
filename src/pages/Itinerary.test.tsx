import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import Itinerary from "./Itinerary"

const STORAGE_KEY = "wetravel_itinerary_drafts_v1"
const createTrip = (title = "California weekend") => {
  fireEvent.click(screen.getByRole("button", { name: /new itinerary/i }))
  fireEvent.change(screen.getByRole("textbox", { name: /trip name/i }), { target: { value: title } })
  fireEvent.click(screen.getByRole("button", { name: /create trip/i }))
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.stubGlobal("crypto", { randomUUID: vi.fn()
    .mockReturnValueOnce("trip-1")
    .mockReturnValueOnce("destination-1")
    .mockReturnValueOnce("trip-2") })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Itinerary", () => {
  it("shows the empty state when no draft trips are saved", () => {
    render(<Itinerary />)
    expect(screen.getByText("No trips yet")).toBeInTheDocument()
    expect(screen.getByText("Your next trip starts here")).toBeInTheDocument()
  })

  it("creates an itinerary and saves it in localStorage", () => {
    render(<Itinerary />)
    createTrip()
    expect(screen.getByRole("heading", { name: "California weekend" })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    expect(saved).toMatchObject([{ id: "trip-1", title: "California weekend", destinations: [] }])
  })

  it("adds and removes a destination, including its notes", () => {
    render(<Itinerary />)
    createTrip()
    fireEvent.change(screen.getByRole("textbox", { name: /place name/i }), { target: { value: "Golden Gate Bridge" } })
    fireEvent.change(screen.getByRole("textbox", { name: /notes/i }), { target: { value: "Visit at sunset" } })
    fireEvent.click(screen.getByRole("button", { name: /add destination/i }))
    expect(screen.getByText("Golden Gate Bridge")).toBeInTheDocument()
    expect(screen.getByText("Visit at sunset")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")[0].destinations).toMatchObject([
      { id: "destination-1", name: "Golden Gate Bridge", notes: "Visit at sunset" },
    ])
    fireEvent.click(screen.getByRole("button", { name: "Remove Golden Gate Bridge" }))
    expect(screen.queryByText("Visit at sunset")).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")[0].destinations).toEqual([])
  })

  it("loads saved drafts after remounting", () => {
    const first = render(<Itinerary />)
    createTrip()
    first.unmount()
    render(<Itinerary />)
    expect(screen.getByRole("heading", { name: "California weekend" })).toBeInTheDocument()
    expect(screen.getByRole("button", {name: /^california weekend/i})).toHaveAttribute("aria-current", "true")
  })

  it("deletes an itinerary from the page and localStorage", () => {
    render(<Itinerary />)
    createTrip()
    fireEvent.click(screen.getByRole("button", { name: "Delete itinerary California weekend" }))
    expect(screen.getByText("No trips yet")).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([])
  })

  it("ignores malformed saved itinerary data", () => {
    localStorage.setItem(STORAGE_KEY, "not-json")
    render(<Itinerary />)
    expect(screen.getByText("No trips yet")).toBeInTheDocument()
  })
})
