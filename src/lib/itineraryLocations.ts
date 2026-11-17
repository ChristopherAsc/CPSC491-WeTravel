
import { API_BASE_URL } from "@/api_configs"

export type ItineraryLocation = {
  location_id: number
  name: string
  latitude: number
  longitude: number
}

export async function getItineraryLocations(): Promise<
  ItineraryLocation[]
> {
  const response = await fetch(
    `${API_BASE_URL}/api/locations?limit=200`
  )

  if (!response.ok) {
    throw new Error(
      `Failed to load destinations (${response.status})`
    )
  }

  return response.json() as Promise<ItineraryLocation[]>
}
