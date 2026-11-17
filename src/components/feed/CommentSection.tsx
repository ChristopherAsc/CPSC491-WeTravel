import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { LoaderCircle, Send } from "lucide-react"

import { ApiRequestError, createPostComment, getPostComments, type PostComment } from "@/api_configs"
import { handleUnauthorized } from "@/auth/authFetch"
import { useAuth } from "@/auth/useAuth"
import { readableDate } from "@/lib/formatDate"

const MAX_COMMENT_LENGTH = 500

type CommentSectionProps = {
  postId: number
  // Lets the post card keep its comment count in step with new comments
  onCommentAdded?: () => void
}

export default function CommentSection({ postId, onCommentAdded }: CommentSectionProps) {
  const { token } = useAuth()
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getPostComments(postId, token)
      .then((loaded) => {
        if (cancelled) return
        setComments(loaded)
        setLoadError(null)
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load comments right now.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [postId, token, reloadCount])

  function reload() {
    setLoading(true)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const content = draft.trim()
    if (!content || submitting || !token) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const created = await createPostComment(postId, content, token)
      setComments((current) => [...current, created])
      setDraft("")
      onCommentAdded?.()
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // Ends the session in AuthProvider, which signs the user out everywhere
        if (error.status === 401) handleUnauthorized()
        setSubmitError(error.message)
      } else {
        setSubmitError("Couldn't post your comment. Check your connection and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div id={`comments-${postId}`} className="space-y-3 border-t border-gray-100 pt-4">
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Loading comments...</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-700">
          {loadError}{" "}
          <button type="button" onClick={reload} className="font-semibold underline">Try again</button>
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet. Be the first to comment.</p>
      ) : (
        <ul aria-label="Comments" className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.comment_id} className="text-sm">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-gray-900">{comment.username}</span>
                <time dateTime={comment.created_at} className="text-xs text-gray-500">{readableDate(comment.created_at)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-gray-800">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}

      {token ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Add a comment..."
              aria-label="Add a comment"
              disabled={submitting}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting || draft.trim().length === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#15558b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} aria-hidden="true" />
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
          {draft.length >= MAX_COMMENT_LENGTH - 50 && (
            <p className="text-right text-xs text-gray-500">{draft.length} / {MAX_COMMENT_LENGTH}</p>
          )}
          {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
        </form>
      ) : (
        <p className="text-sm text-gray-600"><Link to="/login" className="font-semibold underline">Log in</Link> to join the conversation.</p>
      )}
    </div>
  )
}
