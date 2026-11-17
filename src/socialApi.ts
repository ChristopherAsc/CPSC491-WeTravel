import { authFetch } from "@/auth/authFetch"

export type PublicTraveler = { user_id: number; username: string; avatar_url?: string | null }
export type FriendRequest = { request_id: number; sender: PublicTraveler; recipient: PublicTraveler; status: "pending" | "accepted" | "declined" }

export async function socialRequest<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await authFetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null)
    const error = result && typeof result === "object" && "detail" in result ? result.detail : null
    throw new Error(typeof error === "string" ? error : `Request failed (${response.status})`)
  }
  return await response.json() as T
}
