import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { socialRequest, type PublicTraveler } from "@/socialApi"

export default function TravelerSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PublicTraveler[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  async function search(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setSearched(false)
    try {
      const users = await socialRequest<PublicTraveler[]>(`/users/search?username=${encodeURIComponent(query)}`)
      setResults(users); setSearched(true)
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed") }
    finally { setLoading(false) }
  }
  return <main className="mx-auto max-w-2xl space-y-6 pb-20">
    <h1 className="text-3xl font-bold text-[#0D3B66]">Find Travelers</h1>
    <form onSubmit={e => { void search(e) }} className="flex gap-3">
      <label htmlFor="traveler-query" className="sr-only">Search usernames</label>
      <input id="traveler-query" className="min-w-0 flex-1 rounded-lg border p-3" value={query} onChange={e => setQuery(e.target.value)} required placeholder="Search by username" />
      <button disabled={loading} className="rounded-lg bg-[#0D3B66] px-5 text-white">Search</button>
    </form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {loading && <p role="status">Searching...</p>}
    {searched && results.length === 0 && <p role="status">No users found.</p>}
    <ul className="space-y-2">{results.map(user => <li key={user.user_id} className="rounded-lg border p-4"><Link className="font-semibold text-[#0D3B66] underline" to={`/travelers/${user.user_id}`}>{user.username}</Link></li>)}</ul>
  </main>
}
