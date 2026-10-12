import { useState } from "react"
import { CalendarDays, Check, Compass, MapPin, Plus, Trash2, X } from "lucide-react"

type Destination = { id: string; name: string; notes: string }
type Trip = { id: string; title: string; destinations: Destination[] }
const STORAGE_KEY = "wetravel_itinerary_drafts_v1"
const newId = () => crypto.randomUUID()
const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0D3B66] focus:ring-2 focus:ring-blue-100"

function readDrafts(): Trip[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const value: unknown = JSON.parse(stored)
    if (!Array.isArray(value)) return []
    return value.filter((trip): trip is Trip =>
      typeof trip === "object" && trip !== null &&
      typeof trip.id === "string" && typeof trip.title === "string" &&
      Array.isArray(trip.destinations) && trip.destinations.every((item: unknown) =>
        typeof item === "object" && item !== null &&
        "id" in item && typeof item.id === "string" &&
        "name" in item && typeof item.name === "string" &&
        "notes" in item && typeof item.notes === "string"))
  } catch { return [] }
}

function Itinerary() {
  const [trips, setTrips] = useState<Trip[]>(readDrafts)
  const [selectedId, setSelectedId] = useState<string | null>(() => readDrafts()[0]?.id ?? null)
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [newTripTitle, setNewTripTitle] = useState("")
  const [destinationName, setDestinationName] = useState("")
  const [destinationNotes, setDestinationNotes] = useState("")
  const [message, setMessage] = useState("")

  const selectedTrip = trips.find((trip) => trip.id === selectedId)

  function commit(next: Trip[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setTrips(next)
      setMessage("")
    } catch {
      setMessage("Could not save your draft in this browser. Check available storage.")
    }
  }

  function addTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTripTitle.trim()
    if (!title) return
    const trip: Trip = { id: newId(), title, destinations: [] }
    commit([trip, ...trips])
    setSelectedId(trip.id)
    setNewTripTitle("")
    setShowNewTrip(false)
  }

  function addDestination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTrip || !destinationName.trim()) return
    const next = trips.map((trip) => trip.id === selectedTrip.id ? {
      ...trip,
      destinations: [...trip.destinations, {
        id: newId(), name: destinationName.trim(), notes: destinationNotes.trim(),
      }],
    } : trip)
    commit(next)
    setDestinationName("")
    setDestinationNotes("")
  }

  function removeDestination(destinationId: string) {
    commit(trips.map((trip) => trip.id === selectedId
      ? { ...trip, destinations: trip.destinations.filter((destination) => destination.id !== destinationId) }
      : trip))
  }

  function removeTrip(id: string) {
    const next = trips.filter((trip) => trip.id !== id)
    commit(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
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

      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>UI preview:</strong> Your itinerary drafts are saved only in this browser. Account syncing, database storage, and destination search will be connected later.
      </div>
      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      {showNewTrip && (
        <form onSubmit={addTrip} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[#0D3B66]">Create an itinerary</h2><button type="button" aria-label="Cancel creating itinerary" onClick={() => setShowNewTrip(false)}><X size={18} /></button></div>
          <label htmlFor="new-trip-title" className="mb-1 block text-sm font-medium">Trip name</label>
          <div className="flex flex-col gap-3 sm:flex-row"><input id="new-trip-title" className={fieldClass} value={newTripTitle} onChange={(e) => setNewTripTitle(e.target.value)} maxLength={90} required placeholder="e.g. Weekend in San Francisco" /><button type="submit" disabled={!newTripTitle.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Check size={16} /> Create trip</button></div>
        </form>
      )}

      <div className="grid gap-5 md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[#0D3B66]">My itineraries</h2><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{trips.length}</span></div>
          {trips.length === 0 ? (
            <div className="rounded-lg bg-gray-50 px-4 py-10 text-center"><CalendarDays className="mx-auto mb-3 text-gray-400" size={28} /><p className="text-sm font-medium text-gray-700">No trips yet</p><p className="mt-1 text-xs text-gray-500">Create your first itinerary to begin planning.</p></div>
          ) : (
            <ul className="space-y-2">{trips.map((trip) => (
              <li key={trip.id}><button type="button" onClick={() => { setSelectedId(trip.id); setDestinationName(""); setDestinationNotes("") }} aria-current={trip.id === selectedId ? "true" : undefined} className={`w-full rounded-lg border p-3 text-left transition-colors ${trip.id === selectedId ? "border-[#0D3B66] bg-blue-50" : "border-transparent hover:bg-gray-50"}`}><span className="block truncate text-sm font-semibold text-gray-900">{trip.title}</span><span className="mt-1 block text-xs text-gray-500">{trip.destinations.length} destination{trip.destinations.length !== 1 ? "s" : ""}</span></button></li>
            ))}</ul>
          )}
        </aside>

        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          {!selectedTrip ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center"><MapPin size={36} className="mb-4 text-gray-400" /><h2 className="text-xl font-semibold text-[#0D3B66]">Your next trip starts here</h2><p className="mt-2 max-w-sm text-sm text-gray-600">Create an itinerary to start adding places you want to visit.</p><button type="button" onClick={() => setShowNewTrip(true)} className="mt-5 rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white">Create itinerary</button></div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-5"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Trip planner</p><h2 className="break-words text-2xl font-bold text-[#0D3B66]">{selectedTrip.title}</h2><p className="mt-1 text-sm text-gray-500">{selectedTrip.destinations.length} places on your itinerary</p></div><button type="button" onClick={() => removeTrip(selectedTrip.id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50" aria-label={`Delete itinerary ${selectedTrip.title}`}><Trash2 size={16} /> Delete trip</button></div>
              <div><h3 className="mb-3 text-base font-semibold text-[#0D3B66]">Destinations</h3>{selectedTrip.destinations.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-7 text-center text-sm text-gray-600">No destinations added yet. Add a place below to start your route.</div> : <ol className="space-y-3">{selectedTrip.destinations.map((destination, index) => <li key={destination.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-[#0D3B66]">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words font-semibold text-gray-900">{destination.name}</p>{destination.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">{destination.notes}</p>}</div><button type="button" onClick={() => removeDestination(destination.id)} aria-label={`Remove ${destination.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"><X size={17} /></button></li>)}</ol>}</div>
              <form onSubmit={addDestination} className="space-y-3 rounded-xl bg-gray-50 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-semibold text-[#0D3B66]"><MapPin size={18} /> Add a destination</h3><div><label htmlFor="destination-name" className="mb-1 block text-sm font-medium text-gray-700">Place name</label><input id="destination-name" className={fieldClass} placeholder="e.g. Golden Gate Bridge" value={destinationName} onChange={(e) => setDestinationName(e.target.value)} maxLength={120} required /></div><div><label htmlFor="destination-notes" className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label><textarea id="destination-notes" className={fieldClass} rows={2} maxLength={500} placeholder="Things to do, places to eat, travel tips..." value={destinationNotes} onChange={(e) => setDestinationNotes(e.target.value)} /></div><button type="submit" disabled={!destinationName.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={17} /> Add destination</button></form>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Itinerary
