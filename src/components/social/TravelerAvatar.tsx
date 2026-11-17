import { UserRound } from "lucide-react"

export default function TravelerAvatar({ username, avatarUrl, size = "md" }: {
  username: string
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg"
}) {
  const dimensions = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-11 w-11 text-lg" : "h-14 w-14 text-xl"
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50 font-bold text-[#0D3B66] ${dimensions}`} aria-label={`${username}'s avatar`}>
    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : username ? username.slice(0, 1).toUpperCase() : <UserRound size={24} aria-hidden="true" />}
  </span>
}
