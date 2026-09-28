import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

import { MarkerLayer } from "@/components/map/MarkerLayer"

export function Map() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN

    if (!token) {
      console.error("Missing VITE_MAPBOX_TOKEN")
      return
    }

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
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapInstance(null)
    }
  }, [])

  return (
    <>
      <div
        ref={mapContainerRef}
        className="h-[500px] w-full rounded-lg"
      />

      {mapInstance && <MarkerLayer map={mapInstance} />}
    </>
  )
}