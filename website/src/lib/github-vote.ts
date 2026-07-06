// Client for the in-place community-demo voting worker (workers/svgrid-vote).
//
// When VITE_VOTE_API is set at build time, the playground's Upvote control
// becomes a live 👍 toggle backed by the visitor's own GitHub account. When it's
// NOT set, `votingEnabled()` is false and callers fall back to linking out to the
// GitHub discussion - so the site works either way.
//
// The GitHub token never reaches this code: it stays in the worker's encrypted
// httpOnly cookie. We only ever hold a per-session CSRF token here, in a
// module-scoped variable (not localStorage), so arbitrary playground code can't
// read it off `window` or storage.

const VOTE_API = (import.meta.env.VITE_VOTE_API as string | undefined)?.replace(/\/$/, '')

export function votingEnabled(): boolean {
  return !!VOTE_API
}

export type VoteMe = { authenticated: boolean; login?: string; avatar?: string }
export type VoteState = { count: number; viewerReacted: boolean }

// Kept out of localStorage/window on purpose (playground evals untrusted code).
let csrf: string | null = null
let mePromise: Promise<VoteMe> | null = null

/** Who is signed in (cached for the page). Returns { authenticated:false } if not. */
export function getMe(force = false): Promise<VoteMe> {
  if (!VOTE_API) return Promise.resolve({ authenticated: false })
  if (mePromise && !force) return mePromise
  mePromise = fetch(`${VOTE_API}/me`, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : { authenticated: false }))
    .then((d: VoteMe & { csrf?: string }) => {
      csrf = d.csrf ?? null
      return { authenticated: !!d.authenticated, login: d.login, avatar: d.avatar }
    })
    .catch(() => ({ authenticated: false }))
  return mePromise
}

/** Redirect to GitHub sign-in, returning to `returnTo` afterwards. */
export function signIn(returnTo: string): void {
  if (!VOTE_API) return
  window.location.href = `${VOTE_API}/auth/login?return_to=${encodeURIComponent(returnTo)}`
}

/** The signed-in user's current 👍 state for a discussion (null if not signed in). */
export async function getReactionState(discussion: number): Promise<VoteState | null> {
  if (!VOTE_API || !discussion) return null
  try {
    const r = await fetch(`${VOTE_API}/state?discussion=${discussion}`, { credentials: 'include' })
    if (!r.ok) return null
    const d = await r.json()
    if (!d.authenticated) return null
    return { count: d.count, viewerReacted: d.viewerReacted }
  } catch {
    return null
  }
}

/**
 * Toggle the viewer's 👍 on a discussion. Returns the fresh state, or throws
 * `NOT_AUTHENTICATED` so the caller can kick off sign-in.
 */
export async function toggleReaction(discussion: number, on: boolean): Promise<VoteState> {
  if (!VOTE_API) throw new Error('voting disabled')
  if (!csrf) await getMe(true)
  const r = await fetch(`${VOTE_API}/react`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF': csrf } : {}) },
    body: JSON.stringify({ discussion, on }),
  })
  if (r.status === 401) throw new Error('NOT_AUTHENTICATED')
  if (!r.ok) throw new Error(`vote failed (${r.status})`)
  return r.json()
}
