
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

type SafetyGroup = {
  longitude: number
  latitude: number
  locationName: string
  reports: SafetyReport[]
}

export function SafetyLayer({
  map,
  refreshKey = 0,
}: SafetyLayerProps) {
  const [reports, setReports] = useState<SafetyReport[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadReports() {
      try {
        const data = await getSafetyReports()

        if (!cancelled) {
          setReports(data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load safety reports:", error)
        }
      }
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    // Group reports by their coordinates.
    const groups = new Map<string, SafetyGroup>()

    for (const report of reports) {
      const location = report.location

      if (
        !location ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        location.latitude < -90 ||
        location.latitude > 90 ||
        location.longitude < -180 ||
        location.longitude > 180
      ) {
        continue
      }

      const key = `${location.latitude},${location.longitude}`

      const existing = groups.get(key)

      if (existing) {
        existing.reports.push(report)
      } else {
        groups.set(key, {
          longitude: location.longitude,
          latitude: location.latitude,
          locationName: location.name,
          reports: [report],
        })
      }
    }

    // Create one marker for each coordinate group.
    const markers = Array.from(groups.values()).map((group) => {
      const element = document.createElement("div")

      element.className =
        "flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-xs font-bold text-white shadow"

      element.textContent = String(group.reports.length)
      element.title = `${group.reports.length} safety report(s)`

      const popupContent = document.createElement("div")
      popupContent.className = "space-y-2"

      const heading = document.createElement("h3")
      heading.className = "font-semibold"
      heading.textContent = group.locationName

      const count = document.createElement("p")
      count.textContent =
        `${group.reports.length} safety incident(s) reported`

      popupContent.append(heading, count)

      for (const report of group.reports) {
        const reportContainer = document.createElement("div")
        reportContainer.className = "border-t pt-2"

        const reportType = document.createElement("strong")
        reportType.textContent = report.report_type

        const description = document.createElement("p")
        description.textContent = report.description

        reportContainer.append(reportType, description)
        popupContent.append(reportContainer)
      }

      const popup = new mapboxgl.Popup({
        offset: 24,
        maxWidth: "320px",
      }).setDOMContent(popupContent)

      return new mapboxgl.Marker({ element })
        .setLngLat([group.longitude, group.latitude])
        .setPopup(popup)
        .addTo(map)
    })

    return () => {
      markers.forEach((marker) => marker.remove())
    }
  }, [map, reports])

  return null
}
