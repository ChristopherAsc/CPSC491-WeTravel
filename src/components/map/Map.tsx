import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { SafetyLayer } from "@/components/map/SafetyLayer"
import { MarkerLayer } from "@/components/map/MarkerLayer"

export function Map() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const token = import.meta.env.VITE_MAPBOX_TOKEN

  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !token) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-117.9243, 33.8704],
      zoom: 10,
    })

    mapRef.current = map

    map.on("load", () => {
      setMapInstance(map)
      setIsLoading(false)
    })

    map.on("error", () => {
      setMapError("Unable to load the map.")
      setIsLoading(false)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapInstance(null)
    }
  }, [token])

  const error = !token ? "Mapbox token is missing." : mapError

  if (error) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="h-[500px] w-full rounded-lg"
      />

      {mapInstance && (
  <>
    <MarkerLayer map={mapInstance} />
    <SafetyLayer map={mapInstance} />
  </>
)}
    </div>
  )
}