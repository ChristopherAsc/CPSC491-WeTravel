import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/auth/useAuth"
import { socialRequest } from "@/socialApi"
import { LockKeyhole, Globe2 } from "lucide-react"

type Account = { user_id: number; username: string; email: string; is_private: boolean }

export default function AccountSettings() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let active = true
    socialRequest<Account>("/users/me")
      .then((data) => { if (active) { setUsername(data.username); setEmail(data.email); setIsPrivate(data.is_private) } })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Cannot load settings") })
    return () => { active = false }
  }, [])

  async function perform(action: () => Promise<unknown>, success: string) {
    setWorking(true); setError(""); setMessage("")
    try { await action(); setMessage(success) }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed") }
    finally { setWorking(false) }
  }

  async function changePrivacy(nextValue: boolean) {
    setPrivacySaving(true)
    setError("")
    setMessage("")
    try {
      const updated = await socialRequest<Account>("/users/me/privacy", "PATCH", { is_private: nextValue })
      setIsPrivate(updated.is_private)
      setMessage(updated.is_private ? "Your posts are now private." : "Your posts are now public.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update profile privacy")
    } finally { setPrivacySaving(false) }
  }

  function saveUsername(e: FormEvent) {
    e.preventDefault()
    void perform(() => socialRequest("/users/me", "PATCH", { username }), "Username updated. Refresh to verify persistence.")
  }

  function savePassword(e: FormEvent) {
    e.preventDefault()
    void perform(async () => {
      await socialRequest("/users/me/password", "PUT", { current_password: currentPassword, new_password: newPassword })
      setCurrentPassword(""); setNewPassword("")
    }, "Password changed. Use your new password for future logins.")
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault()
    await perform(async () => {
      await socialRequest("/users/me", "DELETE", { password: deletePassword })
      logout(); navigate("/login", { replace: true })
    }, "Account deleted")
  }

  return <main className="mx-auto max-w-2xl space-y-7 pb-20">
    <h1 className="text-3xl font-bold text-[#0D3B66]">Account Settings</h1>
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5" aria-label="Profile privacy settings">
      <div className="flex items-center gap-3 text-[#0D3B66]">
        {isPrivate ? <LockKeyhole size={22} aria-hidden="true" /> : <Globe2 size={22} aria-hidden="true" />}
        <h2 className="text-xl font-semibold">Profile privacy</h2>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Private profile</p>
          <p className="mt-1 text-sm text-gray-600">When enabled, only you and accepted friends can view your travel posts. Your posts never appear in the public feed. Your username remains searchable.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <input type="checkbox" role="switch" aria-label="Private profile" aria-checked={isPrivate}
            checked={isPrivate} disabled={privacySaving} onChange={e => { void changePrivacy(e.target.checked) }}
            className="h-5 w-5 accent-[#0D3B66]" />
          {isPrivate ? "Private" : "Public"}
        </label>
      </div>
      <p className="text-xs text-gray-500">Privacy updates take effect immediately and remain saved after refresh.</p>
    </section>
    <form onSubmit={saveUsername} className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Account information</h2>
      <p className="text-sm text-gray-600">Email: {email || "Loading..."} (not editable)</p>
      <label htmlFor="settings-username" className="block text-sm font-medium">Username</label>
      <input id="settings-username" className="w-full rounded-lg border p-2" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9_]+" />
      <button disabled={working} className="rounded-lg bg-[#0D3B66] px-4 py-2 text-white disabled:opacity-50">Save username</button>
    </form>
    <form onSubmit={savePassword} className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Change password</h2>
      <label htmlFor="settings-current" className="block text-sm">Current password</label>
      <input id="settings-current" type="password" autoComplete="current-password" className="w-full rounded-lg border p-2" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
      <label htmlFor="settings-new" className="block text-sm">New password (at least 8 characters)</label>
      <input id="settings-new" type="password" autoComplete="new-password" className="w-full rounded-lg border p-2" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      <button disabled={working} className="rounded-lg bg-[#0D3B66] px-4 py-2 text-white disabled:opacity-50">Change password</button>
    </form>
    <section className="space-y-3 rounded-xl border border-red-200 p-5">
      <h2 className="text-xl font-semibold text-red-800">Delete account</h2>
      <p className="text-sm">Deleting your account permanently removes your posts, itineraries, safety reports, and friendships. This cannot be undone.</p>
      {!confirmDelete ? <button type="button" className="rounded-lg border border-red-700 px-4 py-2 text-red-700" onClick={() => setConfirmDelete(true)}>Delete account...</button> :
      <form onSubmit={e => { void deleteAccount(e) }} className="space-y-3">
        <label htmlFor="settings-delete-password" className="block text-sm">Confirm with your current password</label>
        <input id="settings-delete-password" type="password" autoComplete="current-password" className="w-full rounded-lg border p-2" required value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
        <button disabled={working} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">Permanently delete my account</button>
        <button type="button" className="ml-3 underline" onClick={() => { setConfirmDelete(false); setDeletePassword("") }}>Cancel</button>
      </form>}
    </section>
  </main>
}
