import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Search, UserRound } from "lucide-react"
import { socialRequest, type PublicTraveler } from "@/socialApi"

// Search stays in the navigation instead of opening a separate search page.
export default function TravelerSearchBar() {
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<PublicTraveler[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeIndex, setActiveIndex] = useState(-1)
  const requestNumber = useRef(0)
  const navigate = useNavigate()
  const trimmed = query.trim()

  useEffect(() => {
    const currentRequest = ++requestNumber.current
    if (!trimmed) return
    const timer = window.setTimeout(() => {
      socialRequest<PublicTraveler[]>(`/users/search?username=${encodeURIComponent(trimmed)}`)
        .then((users) => {
          if (requestNumber.current === currentRequest) {
            setMatches(users.slice(0, 8))
            setLoading(false)
          }
        })
        .catch((reason: unknown) => {
          if (requestNumber.current === currentRequest) {
            setError(reason instanceof Error ? reason.message : "Search failed")
            setLoading(false)
          }
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [trimmed])

  function choose(traveler: PublicTraveler) {
    setIsFocused(false)
    setQuery("")
    setMatches([])
    navigate(`/travelers/${traveler.user_id}`)
  }

  const showMenu = isFocused && trimmed.length > 0

  return (
    <div className="relative w-full min-w-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
    }}>
      <label htmlFor="nav-traveler-search" className="sr-only">Search travelers</label>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-[#0D3B66] focus-within:bg-white">
        <Search size={17} className="shrink-0 text-gray-500" aria-hidden="true" />
        <input
          id="nav-traveler-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showMenu}
          aria-controls="nav-traveler-results"
          aria-activedescendant={activeIndex >= 0 && showMenu ? `nav-traveler-option-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Search travelers"
          className="w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500"
          value={query}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setMatches([])
            setError("")
            setLoading(Boolean(event.target.value.trim()))
            setActiveIndex(-1)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setIsFocused(false); event.currentTarget.blur() }
            if (event.key === "ArrowDown" && matches.length) {
              event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
            }
            if (event.key === "ArrowUp" && matches.length) {
              event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0))
            }
            if (event.key === "Enter" && matches.length && activeIndex >= 0) {
              event.preventDefault(); choose(matches[activeIndex])
            }
          }}
        />
      </div>
      {showMenu && (
        <div id="nav-traveler-results" role="listbox" aria-label="Traveler results" className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          {loading ? <p role="status" className="px-4 py-3 text-sm text-gray-500">Searching...</p> :
            error ? <p role="alert" className="px-4 py-3 text-sm text-red-700">{error}</p> :
            matches.length === 0 ? <p role="status" className="px-4 py-3 text-sm text-gray-500">No users found.</p> :
            matches.map((traveler, index) => (
              <Link
                key={traveler.user_id}
                id={`nav-traveler-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                to={`/travelers/${traveler.user_id}`}
                onClick={(event) => { event.preventDefault(); choose(traveler) }}
                className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 ${activeIndex === index ? "bg-blue-50" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-[#0D3B66]">
                  {traveler.avatar_url ? <img src={traveler.avatar_url} alt="" className="h-full w-full object-cover" /> : traveler.username ? traveler.username[0].toUpperCase() : <UserRound size={18} />}
                </span>
                <span className="truncate font-medium text-gray-800">{traveler.username}</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}
