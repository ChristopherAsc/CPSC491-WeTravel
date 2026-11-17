import { useState, useEffect } from "react"
import { CalendarDays, Check, Compass, MapPin, Plus, X} from "lucide-react"

import {
  getItineraries,
  createItinerary,
  updateItinerary,
  addDestination,
  removeDestination,
  type Itinerary as ApiItinerary,
} from "@/lib/itineraryApi"

import {
  getItineraryLocations,
  type ItineraryLocation,
} from "@/lib/itineraryLocations"



const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0D3B66] focus:ring-2 focus:ring-blue-100"


function Itinerary() {
  const [trips, setTrips] = useState<ApiItinerary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [locations, setLocations] = useState<ItineraryLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showNewTrip, setShowNewTrip] = useState(false)
  const [newTripTitle, setNewTripTitle] = useState("")
  const [newTripDescription, setNewTripDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [message, setMessage] = useState("")

  const selectedTrip = trips.find(
  (trip) => trip.itinerary_id === selectedId
)


  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [savedTrips, availableLocations] = await Promise.all([
          getItineraries(),
          getItineraryLocations(),
        ])

        if (!active) return

        setTrips(savedTrips)
        setLocations(availableLocations)
        setSelectedId(savedTrips[0]?.itinerary_id ?? null)
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Failed to load itineraries"
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  async function addTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    if (!newTripTitle.trim() || !startDate || !endDate) {
      setMessage("Please complete the required fields.")
      return
    }

    if (endDate < startDate) {
      setMessage("End date cannot be before start date.")
      return
    }

    setSaving(true)
    setMessage("")

    try {
      const trip = await createItinerary({
        name: newTripTitle.trim(),
        description: newTripDescription.trim(),
        start_date: startDate,
        end_date: endDate,
        destinations: [],
      })

      setTrips((previous) => [trip, ...previous])
      setSelectedId(trip.itinerary_id)

      setNewTripTitle("")
      setNewTripDescription("")
      setStartDate("")
      setEndDate("")
      setShowNewTrip(false)

      setMessage("Itinerary created successfully!")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create itinerary"
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDestination(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!selectedTrip || !selectedLocationId || saving) return

    setSaving(true)
    setMessage("")

    try {
      const updated = await addDestination(
        selectedTrip.itinerary_id,
        Number(selectedLocationId)
      )

      setTrips((previous) =>
        previous.map((trip) =>
          trip.itinerary_id === updated.itinerary_id ? updated : trip
        )
      )

      setSelectedLocationId("")
      setMessage("Destination added successfully!")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add destination"
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveDestination(locationId: number) {
    if (!selectedTrip || saving) return

    setSaving(true)
    setMessage("")

    try {
      await removeDestination(selectedTrip.itinerary_id, locationId)

      setTrips((previous) =>
        previous.map((trip) =>
          trip.itinerary_id === selectedTrip.itinerary_id
            ? {
                ...trip,
                destinations: trip.destinations.filter(
                  (destination) => destination.location_id !== locationId
                ),
              }
            : trip
        )
      )

      setMessage("Destination removed successfully!")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove destination"
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p role="status" className="text-sm text-gray-600">
          Loading your itineraries...
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-24 md:pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#0D3B66]"><Compass size={17} /> YOUR ADVENTURES</div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66]">Travel itineraries</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-600">Plan a trip, collect destinations, and keep your travel ideas organized.</p>
        </div>
        <button type="button" onClick={() => setShowNewTrip(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#155383]"><Plus size={18} /> New itinerary</button>
      </header>

 
      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      
{showNewTrip && (
  <form
    onSubmit={addTrip}
    className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
  >
    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-[#0D3B66]">
        Create an itinerary
      </h2>

      <button
        type="button"
        aria-label="Cancel creating itinerary"
        onClick={() => setShowNewTrip(false)}
      >
        <X size={18} />
      </button>
    </div>

    <div>
      <label htmlFor="new-trip-title" className="mb-1 block text-sm font-medium">
        Trip name
      </label>
      <input
        id="new-trip-title"
        className={fieldClass}
        value={newTripTitle}
        onChange={(event) => setNewTripTitle(event.target.value)}
        maxLength={100}
        required
        placeholder="e.g. Weekend in San Francisco"
      />
    </div>

    <div>
      <label htmlFor="trip-description" className="mb-1 block text-sm font-medium">
        Description (optional)
      </label>
      <textarea
        id="trip-description"
        className={fieldClass}
        value={newTripDescription}
        onChange={(event) => setNewTripDescription(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Describe your travel plans"
      />
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="start-date" className="mb-1 block text-sm font-medium">
          Start Date
        </label>
        <input
          id="start-date"
          type="date"
          className={fieldClass}
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="end-date" className="mb-1 block text-sm font-medium">
          End Date
        </label>
        <input
          id="end-date"
          type="date"
          className={fieldClass}
          value={endDate}
          min={startDate || undefined}
          onChange={(event) => setEndDate(event.target.value)}
          required
        />
      </div>
    </div>

    <button
      type="submit"
      disabled={!newTripTitle.trim() || !startDate || !endDate || saving}
      className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
    >
      <Check size={16} />
      {saving ? "Creating..." : "Create trip"}
    </button>
  </form>
)}


      <div className="grid gap-5 md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[#0D3B66]">My itineraries</h2><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{trips.length}</span></div>
          {trips.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-4 py-10 text-center"><CalendarDays className="mx-auto mb-3 text-gray-400" size={28} /><p className="text-sm font-medium text-gray-700">No trips yet</p><p className="mt-1 text-xs text-gray-500">Create your first itinerary to begin planning.</p></div>
          ) : (
            
<ul className="space-y-2">
  {trips.map((trip) => (
    <li key={trip.itinerary_id}>
      <button
        type="button"
        onClick={() => {
          setSelectedId(trip.itinerary_id)
          setSelectedLocationId("")
        }}
        aria-current={
          trip.itinerary_id === selectedId ? "true" : undefined
        }
        className={`w-full rounded-lg border p-3 text-left transition-colors ${
          trip.itinerary_id === selectedId
            ? "border-[#0D3B66] bg-blue-50"
            : "border-transparent hover:bg-gray-50"
        }`}
      >
        <span className="block truncate text-sm font-semibold text-gray-900">
          {trip.name}
        </span>
        <span className="mt-1 block text-xs text-gray-500">
          {trip.destinations.length} destinations
        </span>
      </button>
    </li>
  ))}
</ul>

          )}
        </aside>

        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          {!selectedTrip ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center"><MapPin size={36} className="mb-4 text-gray-400" /><h2 className="text-xl font-semibold text-[#0D3B66]">Your next trip starts here</h2><p className="mt-2 max-w-sm text-sm text-gray-600">Create an itinerary to start adding places you want to visit.</p><button type="button" onClick={() => setShowNewTrip(true)} className="mt-5 rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white">Create itinerary</button></div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-5"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Trip planner</p><h2 className="break-words text-2xl font-bold text-[#0D3B66]">{selectedTrip.name}</h2><p className="mt-1 text-sm text-gray-500">{selectedTrip.destinations.length} places on your itinerary</p></div></div>

<div>
  <h3 className="mb-3 text-base font-semibold text-[#0D3B66]">
    Destinations
  </h3>

  {selectedTrip.destinations.length === 0 ? (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-7 text-center text-sm text-gray-600">
      No destinations added yet. Add a place below to start your route.
    </div>
  ) : (
    <ol className="space-y-3">
      {selectedTrip.destinations.map((destination, index) => (
        <li
          key={destination.location_id}
          className="flex items-start gap-3 rounded-lg border border-gray-200 p-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-[#0D3B66]">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold text-gray-900">
              {destination.name}
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void handleRemoveDestination(destination.location_id)
            }
            aria-label={`Remove ${destination.name}`}
            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
          >
            <X size={17} />
          </button>
        </li>
      ))}
    </ol>
  )}
</div>

              
<form
  onSubmit={handleAddDestination}
  className="space-y-3 rounded-xl bg-gray-50 p-4 sm:p-5"
>
  <h3 className="flex items-center gap-2 font-semibold text-[#0D3B66]">
    <MapPin size={18} />
    Add a destination
  </h3>

  <div>
    <label
      htmlFor="destination-location"
      className="mb-1 block text-sm font-medium text-gray-700"
    >
      Select destination
    </label>

    <select
      id="destination-location"
      className={fieldClass}
      value={selectedLocationId}
      onChange={(event) => setSelectedLocationId(event.target.value)}
      required
    >
      <option value="">Choose a destination</option>

      {locations
        .filter(
          (location) =>
            !selectedTrip.destinations.some(
              (destination) =>
                destination.location_id === location.location_id
            )
        )
        .map((location) => (
          <option
            key={location.location_id}
            value={location.location_id}
          >
            {location.name}
          </option>
        ))}
    </select>
  </div>

  <button
    type="submit"
    disabled={!selectedLocationId || saving}
    className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
  >
    <Plus size={17} />
    {saving ? "Saving..." : "Add destination"}
  </button>
</form>

            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Itinerary
