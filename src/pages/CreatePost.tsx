import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { ImagePlus, MapPin, Send, X } from "lucide-react"
import { useAuth } from "@/auth/useAuth"

import { createPostSchema, type CreatePostFormData } from "@/schemas/createPostSchema"

const initialValues: CreatePostFormData = {
  caption: "",
  locationName: "",
}

const inputStyles = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"

function CreatePost() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [submitError, setSubmitError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function clearImage() {
    setSelectedImage(null)
    setPreviewUrl(null)
    setImageError("")
  }

  function selectImage(file: File | undefined) {
    setImageError("")
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Choose a JPG, PNG, or WebP image.")
      clearImage()
      setImageError("Choose a JPG, PNG, or WebP image.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      clearImage()
      setImageError("Image must be 10 MB or smaller.")
      return
    }
    setSelectedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
  }
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  })

  const captionLength = useWatch({ control, name: "caption" })?.length ?? 0

  function onSubmit(values: CreatePostFormData) {
    setSubmitError("")
    setSuccessMessage("")

    if (selectedImage) {
      setSubmitError("Photo upload is preview-only until image storage is connected. Remove the photo to continue.")
      return
    }

    if (!isAuthenticated) {
      setSubmitError("Please log in before creating a post.")
      return
    }

    // POST /api/posts currently requires a location with latitude/longitude.
    // Wait for an API-backed location selector rather than inventing coordinates.
    setSubmitError(`Location lookup is not connected yet. The place “${values.locationName}” needs to be resolved automatically before this post can be published.`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0D3B66]">Create a travel post</h1>
        <p className="mt-2 text-sm text-gray-600">Share a place you visited with the WeTravel community.</p>
      </div>

      {!isAuthLoading && !isAuthenticated && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          You must be signed in to publish a post. <Link to="/login" className="font-semibold underline">Go to Login</Link>.
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[#0D3B66]"><ImagePlus size={20} aria-hidden="true" /><h2 className="text-lg font-semibold">Your experience</h2></div>
          <div>
            <label htmlFor="caption" className="block text-sm font-medium">Caption <span className="text-red-600">*</span></label>
            <textarea
              id="caption"
              rows={5}
              maxLength={2200}
              placeholder="Tell us about your trip..."
              aria-invalid={Boolean(errors.caption)}
              aria-describedby={errors.caption ? "caption-error" : undefined}
              className={`${inputStyles} resize-y`}
              {...register("caption")}
            />
            <div className="mt-1 flex justify-between gap-3">
              {errors.caption ? <p id="caption-error" role="alert" className="text-sm text-red-600">{errors.caption.message}</p> : <span />}
              <span className="text-xs text-gray-500">{captionLength} / 2200</span>
            </div>
          </div>
          <div>
            <label htmlFor="postImage" className="block text-sm font-medium">Add a photo <span className="font-normal text-gray-500">(optional)</span></label>
            <div className="mt-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center">
              {previewUrl && selectedImage ? (
                <div className="space-y-3">
                  <img src={previewUrl} alt="Selected travel photo preview" className="mx-auto max-h-80 w-full rounded-lg object-contain" />
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <span className="max-w-xs truncate text-gray-700">{selectedImage.name}</span>
                    <button type="button" onClick={clearImage} className="inline-flex items-center gap-1 font-medium text-red-700 hover:underline"><X size={16} aria-hidden="true" /> Remove photo</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImagePlus className="mx-auto text-[#0D3B66]" size={32} aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-800">Choose a photo from your device</p>
                  <p className="text-xs text-gray-500">JPG, PNG or WebP, up to 10 MB</p>
                  <label htmlFor="postImage" className="inline-block cursor-pointer rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15558b]">Browse photos</label>
                </div>
              )}
              <input
                id="postImage"
                aria-label="Upload travel photo"
                aria-describedby="photo-upload-hint"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  selectImage(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
            </div>
            {imageError && <p role="alert" className="mt-1 text-sm text-red-600">{imageError}</p>}
            <p id="photo-upload-hint" className="mt-2 text-xs text-amber-800">Photo selection and preview work now. Uploading photos to storage is not connected yet, so only text-only posts can currently be published.</p>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-5">
          <div className="flex items-center gap-2 text-[#0D3B66]"><MapPin size={20} aria-hidden="true" /><h2 className="text-lg font-semibold">Location</h2></div>
          <p className="text-xs text-gray-500">Enter the destination name. Coordinates will be looked up automatically once location search is connected.</p>
          <div>
            <label htmlFor="locationName" className="block text-sm font-medium">Place name <span className="text-red-600">*</span></label>
            <input id="locationName" type="text" placeholder="Yosemite National Park" aria-invalid={Boolean(errors.locationName)} aria-describedby={errors.locationName ? "location-error" : undefined} className={inputStyles} {...register("locationName")} />
            {errors.locationName && <p id="location-error" role="alert" className="mt-1 text-sm text-red-600">{errors.locationName.message}</p>}
          </div>

        </section>

        {submitError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}
        {successMessage && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">{successMessage} <Link to="/feed" className="font-semibold underline">View Feed</Link></div>}

        <button type="submit" disabled={isSubmitting || isAuthLoading || !isAuthenticated} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#15558b] disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={17} aria-hidden="true" />
          {isSubmitting ? "Publishing..." : "Publish post"}
        </button>
      </form>
    </div>
  )
}

export default CreatePost
