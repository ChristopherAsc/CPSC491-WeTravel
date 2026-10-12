import { Map } from "@/components/map/Map"
import { SafetyReportForm } from "@/components/map/SafetyReportForm"

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Travel Map</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Map />

        <SafetyReportForm />
      </div>
    </div>
  )
}