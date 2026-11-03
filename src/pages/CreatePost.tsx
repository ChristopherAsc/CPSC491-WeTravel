import { useEffect, useState, type KeyboardEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { ImagePlus, LoaderCircle, MapPin, Search, Send, X } from "lucide-react"

import { ApiRequestError, createPost } from "@/api_configs"
import { handleUnauthorized } from "@/auth/authFetch"
import { getToken } from "@/auth/tokenStorage"
import { PlaceSearchError, searchPlaces, type PlaceResult } from "@/lib/placeSearch"
import { createPostSchema, type CreatePostFormData } from "@/schemas/createPostSchema"

const initialValues: CreatePostFormData = {
  caption: "",
  locationName: "",
}

const inputStyles = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"

function CreatePost() {
  const navigate = useNavigate()
  const [isSignedIn, setIsSignedIn] = useState(() => getToken() !== null)
  const [submitError, setSubmitError] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [placeResults, setPlaceResults] = useState<PlaceResult[] | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [placeError, setPlaceError] = useState("")
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false)

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
    trigger,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  })

  const captionLength = useWatch({ control, name: "caption" })?.length ?? 0

  function resetPlaceSearch() {
    setPlaceResults(null)
    setSelectedPlace(null)
    setPlaceError("")
  }

  async function findPlaces() {
    if (!(await trigger("locationName"))) return

    const query = getValues("locationName").trim()
    resetPlaceSearch()
    setIsSearchingPlaces(true)

    try {
      const results = await searchPlaces(query)
      setPlaceResults(results)
      if (results.length === 0) {
        setPlaceError(`No places found for “${query}”. Try a city, landmark, or region name.`)
      }
    } catch (error) {
      setPlaceError(error instanceof PlaceSearchError ? error.message : "Location search failed. Please try again.")
    } finally {
      setIsSearchingPlaces(false)
    }
  }

  function handlePlaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter searches for the place instead of submitting the whole form
    if (event.key === "Enter") {
      event.preventDefault()
      void findPlaces()
    }
  }

  function choosePlace(place: PlaceResult) {
    setSelectedPlace(place)
    clearErrors("locationName")
  }

  async function onSubmit(values: CreatePostFormData) {
    setSubmitError("")

    if (selectedImage) {
      setSubmitError("Photo upload is preview-only until image storage is connected. Remove the photo to continue.")
      return
    }

    const token = getToken()
    if (!token) {
      setIsSignedIn(false)
      setSubmitError("Please log in before creating a post.")
      return
    }

    if (!selectedPlace) {
      setError("locationName", { message: "Search for this place and choose a match before publishing." })
      return
    }

    try {
      const post = await createPost({
        caption: values.caption,
        media_url: null,
        location: {
          name: selectedPlace.fullName.slice(0, 255),
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        },
      }, token)

      navigate("/feed", { state: { publishedPostId: post.post_id } })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          handleUnauthorized()
          setIsSignedIn(false)
        }
        setSubmitError(error.message)
        return
      }
      setSubmitError("Couldn't reach the server, so your post was not published. Check your connection and try again.")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0D3B66]">Create a travel post</h1>
        <p className="mt-2 text-sm text-gray-600">Share a place you visited with the WeTravel community.</p>
      </div>

      {!isSignedIn && (
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
          <p className="text-xs text-gray-500">Search for the destination, then choose the matching place from the results.</p>
          <div>
            <label htmlFor="locationName" className="block text-sm font-medium">Place name <span className="text-red-600">*</span></label>
            <div className="flex gap-2">
              <input
                id="locationName"
                type="text"
                placeholder="Yosemite National Park"
                aria-invalid={Boolean(errors.locationName)}
                aria-describedby={errors.locationName ? "location-error" : undefined}
                className={inputStyles}
                onKeyDown={handlePlaceKeyDown}
                {...register("locationName", { onChange: resetPlaceSearch })}
              />
              <button type="button" onClick={() => void findPlaces()} disabled={isSearchingPlaces} className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#0D3B66] px-3 py-2 text-sm font-semibold text-[#0D3B66] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                {isSearchingPlaces ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
                Find location
              </button>
            </div>
            {errors.locationName && <p id="location-error" role="alert" className="mt-1 text-sm text-red-600">{errors.locationName.message}</p>}
            {placeError && <p role="alert" className="mt-1 text-sm text-red-600">{placeError}</p>}
          </div>

          {selectedPlace ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <span className="flex min-w-0 items-center gap-2"><MapPin size={16} aria-hidden="true" /><span className="truncate">Selected: {selectedPlace.fullName}</span></span>
              <button type="button" onClick={() => setSelectedPlace(null)} className="shrink-0 font-semibold underline">Change</button>
            </div>
          ) : placeResults && placeResults.length > 0 && (
            <ul aria-label="Matching places" className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {placeResults.map((place) => (
                <li key={place.id}>
                  <button type="button" onClick={() => choosePlace(place)} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-blue-50">
                    <span className="text-sm font-medium text-gray-900">{place.name}</span>
                    <span className="text-xs text-gray-500">{place.fullName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {submitError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}

        <button type="submit" disabled={isSubmitting || !isSignedIn} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#15558b] disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={17} aria-hidden="true" />
          {isSubmitting ? "Publishing..." : "Publish post"}
        </button>
      </form>
    </div>
  )
}

export default CreatePost
