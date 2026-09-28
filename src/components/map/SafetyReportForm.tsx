import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  safetyReportSchema,
  type SafetyReportFormData,
} from "@/schemas/safetyReportSchema"

export function SafetyReportForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SafetyReportFormData>({
    resolver: zodResolver(safetyReportSchema),
  })

  function onSubmit(data: SafetyReportFormData) {
    console.log("Safety report:", data)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border p-4"
    >
      <div>
        <h2 className="text-xl font-semibold">Report a Safety Issue</h2>
      </div>

      <div className="space-y-1">
        <label htmlFor="reportType" className="text-sm font-medium">
          Report Type
        </label>

        <select
          id="reportType"
          {...register("reportType")}
          className="w-full rounded-md border bg-background p-2"
        >
          <option value="">Select a report type</option>
          <option value="theft">Theft</option>
          <option value="harassment">Harassment</option>
          <option value="unsafe-area">Unsafe Area</option>
          <option value="other">Other</option>
        </select>

        {errors.reportType && (
          <p className="text-sm text-destructive">
            {errors.reportType.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="location" className="text-sm font-medium">
          Location
        </label>

        <input
          id="location"
          type="text"
          placeholder="Enter location"
          {...register("location")}
          className="w-full rounded-md border bg-background p-2"
        />

        {errors.location && (
          <p className="text-sm text-destructive">
            {errors.location.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="dateTime" className="text-sm font-medium">
          Date and Time
        </label>

        <input
          id="dateTime"
          type="datetime-local"
          {...register("dateTime")}
          className="w-full rounded-md border bg-background p-2"
        />

        {errors.dateTime && (
          <p className="text-sm text-destructive">
            {errors.dateTime.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>

        <textarea
          id="description"
          rows={4}
          placeholder="Describe the safety issue..."
          {...register("description")}
          className="w-full resize-none rounded-md border bg-background p-2"
        />

        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Submit Report
      </button>
    </form>
  )
}