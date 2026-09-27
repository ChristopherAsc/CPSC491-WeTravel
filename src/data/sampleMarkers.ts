export type MapMarker = {
  id: number
  name: string
  longitude: number
  latitude: number
}

export const sampleMarkers: MapMarker[] = [
  {
    id: 1,
    name: "Fullerton",
    longitude: -117.9243,
    latitude: 33.8704,
  },
  {
    id: 2,
    name: "Anaheim",
    longitude: -117.9143,
    latitude: 33.8366,
  },
  {
    id: 3,
    name: "Long Beach",
    longitude: -118.1937,
    latitude: 33.7701,
  },
]