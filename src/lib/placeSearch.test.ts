import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PlaceSearchError, searchPlaces } from "@/lib/placeSearch"

function mockFetch(status: number, json: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json,
    })
  )
}

beforeEach(() => {
  vi.stubEnv("VITE_MAPBOX_TOKEN", "test-mapbox-token")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("searchPlaces", () => {
  it("asks Mapbox for travel places and returns their coordinates", async () => {
    mockFetch(200, async () => ({
      features: [
        {
          id: "poi.1",
          text: "Yosemite Valley",
          place_name: "Yosemite Valley, California, United States",
          center: [-119.5936, 37.7456],
        },
      ],
    }))

    const results = await searchPlaces("  Yosemite Valley ")

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
    expect(url.pathname).toBe("/geocoding/v5/mapbox.places/Yosemite%20Valley.json")
    expect(url.searchParams.get("access_token")).toBe("test-mapbox-token")
    expect(url.searchParams.get("types")?.split(",")).not.toContain("address")
    expect(url.searchParams.get("types")?.split(",")).not.toContain("postcode")
    expect(results).toEqual([
      {
        id: "poi.1",
        name: "Yosemite Valley",
        fullName: "Yosemite Valley, California, United States",
        latitude: 37.7456,
        longitude: -119.5936,
      },
    ])
  })

  it("skips results without usable coordinates", async () => {
    mockFetch(200, async () => ({
      features: [
        { id: "place.1", text: "Nowhere", place_name: "Nowhere", center: [] },
        { id: "place.2", text: "Paris", place_name: "Paris, France", center: [2.35, 48.86] },
      ],
    }))

    const results = await searchPlaces("Paris")

    expect(results.map((place) => place.name)).toEqual(["Paris"])
  })

  it("refuses to search without a Mapbox token", async () => {
    vi.stubEnv("VITE_MAPBOX_TOKEN", "")
    vi.stubGlobal("fetch", vi.fn())

    await expect(searchPlaces("Paris")).rejects.toThrow(PlaceSearchError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reports a failed search with a readable message", async () => {
    mockFetch(401, async () => ({ message: "Not Authorized - Invalid Token" }))

    await expect(searchPlaces("Paris")).rejects.toThrow("Location search failed (401). Please try again.")
  })

  it("reports a network failure with a readable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))

    await expect(searchPlaces("Paris")).rejects.toThrow("Couldn't reach location search.")
  })
})
