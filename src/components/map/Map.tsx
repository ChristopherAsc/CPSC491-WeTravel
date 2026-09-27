import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

export function Map() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const token = import.meta.env.VITE_MAPBOX_TOKEN

    if (!token) {
      console.error("Missing VITE_MAPBOX_TOKEN")
      return
    }

    mapboxgl.accessToken = token

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-117.9243, 33.8704],
      zoom: 10,
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div
      ref={mapContainerRef}
      className="h-[500px] w-full rounded-lg"
    />
  )
}