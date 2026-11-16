import { useEffect, useState } from "react"
import mapboxgl from "mapbox-gl"

import {
  getSafetyReports,
  type SafetyReport,
} from "@/api_configs"

type SafetyLayerProps = {
  map: mapboxgl.Map
  refreshKey?: number
}

export function SafetyLayer({
  map,
  refreshKey = 0,
}: SafetyLayerProps) {
  const [reports, setReports] = useState<SafetyReport[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadReports() {
      try {
        const data = await getSafetyReports()

        if (!cancelled) {
          setReports(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load safety reports"
          )
        }
      }
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    const markers = reports
      .filter(
        (report) =>
          report.location &&
          Number.isFinite(report.location.latitude) &&
          Number.isFinite(report.location.longitude)
      )
      .map((report) => {
        const element = document.createElement("div")

        element.className =
          "h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow"

        const popupContent = document.createElement("div")

        const title = document.createElement("strong")
        title.textContent = report.report_type

        const description = document.createElement("p")
        description.textContent = report.description

        const location = document.createElement("p")
        location.textContent = report.location.name

        popupContent.append(title, description, location)

        const popup = new mapboxgl.Popup({
          offset: 24,
        }).setDOMContent(popupContent)

        return new mapboxgl.Marker({ element })
          .setLngLat([
            report.location.longitude,
            report.location.latitude,
          ])
          .setPopup(popup)
          .addTo(map)
      })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, reports])

  if (error) {
    console.error("Safety reports:", error)
  }

  return null
}
