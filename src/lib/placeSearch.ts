const GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"

// Street addresses and postcodes are excluded so a travel post can't pin someone's home.
const PLACE_TYPES = "country,region,place,locality,neighborhood,poi"

export type PlaceResult = {
  id: string
  name: string
  fullName: string
  latitude: number
  longitude: number
}

export class PlaceSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlaceSearchError"
  }
}

function toPlaceResult(feature: unknown): PlaceResult | null {
  if (!feature || typeof feature !== "object") return null
  const { id, text, place_name, center } = feature as Record<string, unknown>
  if (typeof id !== "string" || typeof text !== "string" || typeof place_name !== "string") return null
  if (!Array.isArray(center) || center.length < 2) return null

  // Mapbox returns coordinates as [longitude, latitude]
  const [longitude, latitude] = center
  if (typeof latitude !== "number" || typeof longitude !== "number") return null

  return { id, name: text, fullName: place_name, latitude, longitude }
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) {
    throw new PlaceSearchError("Location search is unavailable because the Mapbox token is not configured.")
  }

  const params = new URLSearchParams({ access_token: token, limit: "5", types: PLACE_TYPES })

  let response: Response
  try {
    response = await fetch(`${GEOCODING_URL}/${encodeURIComponent(query.trim())}.json?${params}`)
  } catch {
    throw new PlaceSearchError("Couldn't reach location search. Check your connection and try again.")
  }

  if (!response.ok) {
    throw new PlaceSearchError(`Location search failed (${response.status}). Please try again.`)
  }

  const body: unknown = await response.json().catch(() => null)
  const features = body && typeof body === "object" && "features" in body ? body.features : null
  if (!Array.isArray(features)) {
    throw new PlaceSearchError("Location search returned an unexpected response. Please try again.")
  }

  return features.map(toPlaceResult).filter((place): place is PlaceResult => place !== null)
}
