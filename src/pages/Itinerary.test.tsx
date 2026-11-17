
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import Itinerary from "./Itinerary"

import {
  getItineraries,
  createItinerary,
  addDestination,
  removeDestination,
} from "@/lib/itineraryApi"

import { getItineraryLocations } from "@/lib/itineraryLocations"

// Mock itinerary backend API calls
vi.mock("@/lib/itineraryApi", () => ({
  getItineraries: vi.fn(),
  createItinerary: vi.fn(),
  updateItinerary: vi.fn(),
  addDestination: vi.fn(),
  removeDestination: vi.fn(),
}))

// Mock database location retrieval
vi.mock("@/lib/itineraryLocations", () => ({
  getItineraryLocations: vi.fn(),
}))

// Sample location returned by the backend
const location = {
  location_id: 1,
  name: "Golden Gate Bridge",
  latitude: 37.8199,
  longitude: -122.4783,
}

// Sample itinerary returned by the backend
const savedTrip = {
  itinerary_id: 1,
  user_id: 1,
  name: "California weekend",
  description: "Sightseeing trip",
  start_date: "2026-12-01",
  end_date: "2026-12-03",
  destinations: [],
}

// Reset mocks before every test
beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(getItineraries).mockResolvedValue([])
  vi.mocked(getItineraryLocations).mockResolvedValue([location])
})

// Clean up rendered components
afterEach(() => {
  cleanup()
})

describe("Itinerary API Integration", () => {

  // =====================================================
  // 1. Loading State
  // =====================================================

  it("shows the loading state while fetching itineraries", () => {
    vi.mocked(getItineraries).mockReturnValue(
      new Promise(() => {})
    )

    render(<Itinerary />)

    expect(
      screen.getByText("Loading your itineraries...")
    ).toBeInTheDocument()
  })

  // =====================================================
  // 2. Empty State
  // =====================================================

  it("shows the empty state when no itineraries exist", async () => {
    render(<Itinerary />)

    expect(
      await screen.findByText("No trips yet")
    ).toBeInTheDocument()

    expect(
      screen.getByText("Your next trip starts here")
    ).toBeInTheDocument()
  })

  // =====================================================
  // 3. Create Itinerary
  // =====================================================

  it("creates an itinerary through the backend API", async () => {
    vi.mocked(createItinerary).mockResolvedValue(savedTrip)

    render(<Itinerary />)

    fireEvent.click(
      await screen.findByRole("button", {
        name: /new itinerary/i,
      })
    )

    fireEvent.change(
      screen.getByRole("textbox", { name: /trip name/i }),
      { target: { value: "California weekend" } }
    )

    fireEvent.change(
      screen.getByLabelText(/start date/i),
      { target: { value: "2026-12-01" } }
    )

    fireEvent.change(
      screen.getByLabelText(/end date/i),
      { target: { value: "2026-12-03" } }
    )

    fireEvent.click(
      screen.getByRole("button", { name: /create trip/i })
    )

    await waitFor(() => {
      expect(createItinerary).toHaveBeenCalledWith({
        name: "California weekend",
        description: "",
        start_date: "2026-12-01",
        end_date: "2026-12-03",
        destinations: [],
      })
    })

    expect(
      await screen.findByRole("heading", {
        name: "California weekend",
      })
    ).toBeInTheDocument()
  })

  // =====================================================
  // 4. Retrieve Saved Itineraries
  // =====================================================

  it("loads saved itineraries from the backend", async () => {
    vi.mocked(getItineraries).mockResolvedValue([savedTrip])

    render(<Itinerary />)

    expect(
      await screen.findByRole("heading", {
        name: "California weekend",
      })
    ).toBeInTheDocument()

    expect(getItineraries).toHaveBeenCalled()
  })

  // =====================================================
  // 5. Add Destination
  // =====================================================

  it("adds a destination through the backend API", async () => {
    vi.mocked(getItineraries).mockResolvedValue([savedTrip])

    vi.mocked(addDestination).mockResolvedValue({
      ...savedTrip,
      destinations: [location],
    })

    render(<Itinerary />)

    await screen.findByRole("heading", {
      name: "California weekend",
    })

    fireEvent.change(
      screen.getByLabelText(/select destination/i),
      { target: { value: "1" } }
    )

    fireEvent.click(
      screen.getByRole("button", { name: /add destination/i })
    )

    await waitFor(() => {
      expect(addDestination).toHaveBeenCalledWith(1, 1)
    })

    expect(
      await screen.findByRole("button", {
        name: "Remove Golden Gate Bridge",
      })
    ).toBeInTheDocument()
  })

  // =====================================================
  // 6. Remove Destination
  // =====================================================

  it("removes a destination through the backend API", async () => {
    vi.mocked(getItineraries).mockResolvedValue([
      {
        ...savedTrip,
        destinations: [location],
      },
    ])

    vi.mocked(removeDestination).mockResolvedValue(undefined)

    render(<Itinerary />)

    await screen.findByRole("button", {
      name: "Remove Golden Gate Bridge",
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Golden Gate Bridge",
      })
    )

    await waitFor(() => {
      expect(removeDestination).toHaveBeenCalledWith(1, 1)

      expect(
        screen.queryByRole("button", {
          name: "Remove Golden Gate Bridge",
        })
      ).not.toBeInTheDocument()
    })
  })

  // =====================================================
  // 7. API Error Handling
  // =====================================================

  it("displays an error when itinerary loading fails", async () => {
    vi.mocked(getItineraries).mockRejectedValue(
      new Error("Unable to connect to backend")
    )

    render(<Itinerary />)

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Unable to connect to backend")
  })

})
