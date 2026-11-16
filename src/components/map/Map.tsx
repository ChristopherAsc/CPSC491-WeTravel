import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

import { SafetyLayer } from "@/components/map/SafetyLayer"
import { MarkerLayer } from "@/components/map/MarkerLayer"

type MapProps = {
  refreshKey?: number
}

export function Map({ refreshKey = 0 }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const token = import.meta.env.VITE_MAPBOX_TOKEN

  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [zoom, setZoom] = useState(10)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !token) return

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-117.9243, 33.8704],
      zoom: 10,
      minZoom: 1,
      maxZoom: 18,
    })

    mapRef.current = map

    map.on("zoom", () => {
      setZoom(map.getZoom())
    })

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

      {/* Map container */}
      <div ref={mapContainerRef} className="h-[500px] w-full rounded-lg" />

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-lg border bg-background p-3 shadow-lg">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!mapInstance || zoom <= 1}
          onClick={() => mapRef.current?.zoomOut()}
          className="rounded border px-3 py-1 hover:bg-muted disabled:opacity-50"
        >
          −
        </button>

        <input
          type="range"
          aria-label="Map zoom level"
          min="1"
          max="18"
          step="0.5"
          value={zoom}
          disabled={!mapInstance}
          onChange={(event) => {
            const newZoom = Number(event.target.value)
            setZoom(newZoom)
            mapRef.current?.zoomTo(newZoom)
          }}
          className="w-32 cursor-pointer"
        />

        <button
          type="button"
          aria-label="Zoom in"
          disabled={!mapInstance || zoom >= 18}
          onClick={() => mapRef.current?.zoomIn()}
          className="rounded border px-3 py-1 hover:bg-muted disabled:opacity-50"
        >
          +
        </button>

        <span className="min-w-10 text-center text-xs font-medium">
          {zoom.toFixed(1)}
        </span>
      </div>

      {/* Map markers and safety reports */}
      {mapInstance && (
        <>
          <MarkerLayer map={mapInstance} />
          <SafetyLayer map={mapInstance} refreshKey={refreshKey} />
        </>
      )}
    </div>
  )
}
