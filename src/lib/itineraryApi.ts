
import { authFetch } from "@/auth/authFetch"

export type ItineraryDestination = {
  location_id: number
  name: string
  latitude: number
  longitude: number
}

export type Itinerary = {
  itinerary_id: number
  name: string
  description: string | null
  start_date: string
  end_date: string
  destinations: ItineraryDestination[]
}

export type ItineraryCreate = {
  name: string
  description?: string | null
  start_date: string
  end_date: string
  destinations: number[]
}

export type ItineraryUpdate = {
  name?: string
  description?: string | null
  start_date?: string
  end_date?: string
}

async function handleResponse<T>(
  response: Response
): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)

    const message =
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function getItineraries(): Promise<Itinerary[]> {
  const response = await authFetch("/api/itineraries")
  return handleResponse<Itinerary[]>(response)
}

export async function getItinerary(
  id: number
): Promise<Itinerary> {
  const response = await authFetch(`/api/itineraries/${id}`)
  return handleResponse<Itinerary>(response)
}

export async function createItinerary(
  data: ItineraryCreate
): Promise<Itinerary> {
  const response = await authFetch("/api/itineraries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  return handleResponse<Itinerary>(response)
}

export async function updateItinerary(
  id: number,
  data: ItineraryUpdate
): Promise<Itinerary> {
  const response = await authFetch(`/api/itineraries/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  return handleResponse<Itinerary>(response)
}

export async function addDestination(
  itineraryId: number,
  locationId: number
): Promise<Itinerary> {
  const response = await authFetch(
    `/api/itineraries/${itineraryId}/destinations/${locationId}`,
    { method: "POST" }
  )

  return handleResponse<Itinerary>(response)
}

export async function removeDestination(
  itineraryId: number,
  locationId: number
): Promise<void> {
  const response = await authFetch(
    `/api/itineraries/${itineraryId}/destinations/${locationId}`,
    { method: "DELETE" }
  )

  if (!response.ok) {
    throw new Error(
      `Unable to remove destination (${response.status})`
    )
  }
}
