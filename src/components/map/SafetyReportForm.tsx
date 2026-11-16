import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createSafetyReport } from "@/api_configs"
import {
  safetyReportSchema,
  type SafetyReportFormData,
} from "@/schemas/safetyReportSchema"

type SafetyReportFormProps = {
  onSuccess?: () => void
}

export function SafetyReportForm({ onSuccess }: SafetyReportFormProps) {
  const [success, setSuccess] = useState("")
  const [submitError, setSubmitError] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SafetyReportFormData>({
    resolver: zodResolver(safetyReportSchema),
  })

  async function onSubmit(data: SafetyReportFormData) {
    setSuccess("")
    setSubmitError("")

    try {
      await createSafetyReport({
        report_type: data.reportType,
        description: data.description,
        location: {
          name: data.location,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        },
      })

      setSuccess("Safety report submitted successfully!")
      reset()
      onSuccess?.()
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit safety report.",
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border p-4"
    >
      <h2 className="text-xl font-semibold">Report a Safety Issue</h2>

      <div className="space-y-1">
        <label htmlFor="reportType">Report Type</label>
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
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          placeholder="e.g. Yosemite National Park"
          {...register("location")}
          className="w-full rounded-md border bg-background p-2"
        />
        {errors.location && (
          <p className="text-sm text-destructive">{errors.location.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="latitude">Latitude</label>
        <input
          id="latitude"
          type="number"
          step="any"
          placeholder="e.g. 37.8651"
          {...register("latitude")}
          className="w-full rounded-md border bg-background p-2"
        />
        {errors.latitude && (
          <p className="text-sm text-destructive">{errors.latitude.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="longitude">Longitude</label>
        <input
          id="longitude"
          type="number"
          step="any"
          placeholder="e.g. -119.5383"
          {...register("longitude")}
          className="w-full rounded-md border bg-background p-2"
        />
        {errors.longitude && (
          <p className="text-sm text-destructive">{errors.longitude.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="dateTime">Date and Time</label>
        <input
          id="dateTime"
          type="datetime-local"
          {...register("dateTime")}
          className="w-full rounded-md border bg-background p-2"
        />
        {errors.dateTime && (
          <p className="text-sm text-destructive">{errors.dateTime.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="description">Description</label>
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

      {success && (
        <p role="status" className="text-sm text-green-600">
          {success}
        </p>
      )}

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  )
}
