import { useState } from "react"
import { ImageOff, MapPin, CalendarDays, UserRound, Heart, MessageCircle, Bookmark } from "lucide-react"

export type FeedPost = {
  post_id: number
  user_id: number
  caption: string
  media_url: string | null
  location: { name: string; latitude: number; longitude: number } | null
  created_at: string
}

function readableDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)
}

export default function PostCard({ post }: { post: FeedPost }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(post.media_url) && !imageFailed

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0D3B66]" aria-hidden="true"><UserRound size={22} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">Traveler #{post.user_id}</p>
          <p className="flex flex-wrap items-center gap-1 text-xs text-gray-500"><MapPin size={13} aria-hidden="true" /> {post.location?.name || "Location unavailable"}</p>
        </div>
        <p className="flex shrink-0 items-center gap-1 text-xs text-gray-500"><CalendarDays size={13} aria-hidden="true" /><time dateTime={post.created_at}>{readableDate(post.created_at)}</time></p>
      </header>

      <div className="flex min-h-52 items-center justify-center bg-slate-100 sm:min-h-72">
        {showImage ? (
          <img
            src={post.media_url!}
            alt={`Travel photo for ${post.location?.name || "this post"}`}
            className="max-h-[480px] w-full object-contain"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500"><ImageOff size={32} aria-hidden="true" /><span className="text-sm">No photo available for this post</span></div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{post.caption}</p>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-5 text-gray-400" aria-label="Social interactions coming later">
            <span title="Likes coming soon" aria-label="Likes coming soon"><Heart size={20} aria-hidden="true" /></span>
            <span title="Comments coming soon" aria-label="Comments coming soon"><MessageCircle size={20} aria-hidden="true" /></span>
            <span title="Saving posts coming soon" aria-label="Saving posts coming soon"><Bookmark size={20} aria-hidden="true" /></span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-[#0D3B66]"><MapPin size={14} aria-hidden="true" />{post.location?.name || "Unspecified destination"}</span>
        </div>
      </div>
    </article>
  )
}
