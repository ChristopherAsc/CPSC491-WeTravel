import { useEffect } from "react"
import mapboxgl from "mapbox-gl"

type SafetyPoint = {
  id: number
  reportType: string
  longitude: number
  latitude: number
  description: string
}

const sampleSafetyPoints: SafetyPoint[] = [
  {
    id: 1,
    reportType: "unsafe-area",
    longitude: -117.925,
    latitude: 33.87,
    description: "Sample safety report",
  },
  {
    id: 2,
    reportType: "theft",
    longitude: -117.914,
    latitude: 33.837,
    description: "Sample theft report",
  },
]

type SafetyLayerProps = {
  map: mapboxgl.Map
}

export function SafetyLayer({ map }: SafetyLayerProps) {
  useEffect(() => {
    const markers = sampleSafetyPoints.map((point) => {
      const popup = new mapboxgl.Popup({
        offset: 24,
      }).setHTML(
        `<strong>${point.reportType}</strong><br />${point.description}`
      )

      const element = document.createElement("div")

      element.className =
        "h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow"

      return new mapboxgl.Marker({
        element,
      })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map])

  return null
}