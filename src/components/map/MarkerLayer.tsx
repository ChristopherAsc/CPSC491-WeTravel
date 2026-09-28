import { useEffect } from "react"
import mapboxgl from "mapbox-gl"

import { sampleMarkers } from "@/data/sampleMarkers"

type MarkerLayerProps = {
  map: mapboxgl.Map
}

export function MarkerLayer({ map }: MarkerLayerProps) {
  useEffect(() => {
    const markers = sampleMarkers.map((marker) => {
      const popup = new mapboxgl.Popup({
        offset: 24,
      }).setText(marker.name)

      return new mapboxgl.Marker()
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map])

  return null
}