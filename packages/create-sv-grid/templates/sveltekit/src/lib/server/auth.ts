/**
 * Auth scaffold: password hashing, sessions, and role lookup.
 *
 * Everything here runs on the server only - `$lib/server` is a folder SvelteKit
 * enforces, so importing this from a component is a build error rather than a
 * leaked password hash.
 *
 * Like `$lib/people.ts`, the stores are module-level and in-memory: they stand
 * in for your database so the starter runs with no setup. Swap the two arrays
 * for real queries and nothing else has to change. What is *not* a placeholder
 * is the hashing and the cookie handling - those are the real patterns, because
 * getting them wrong is the expensive kind of wrong.
 *
 * Built on Web Crypto rather than `node:crypto`, so the same code runs on Node,
 * Deno, Bun and the edge runtimes `adapter-auto` may select. Nothing here needs
 * a dependency.
 */

export type Role = 'admin' | 'viewer'
export type User = { id: number; email: string; role: Role }

/** A user plus the credential we never hand to the client. */
type StoredUser = User & { passwordHash: string }

/** Name of the session cookie. */
export const SESSION_COOKIE = 'sid'

/** How long a session stays valid. Refreshed on each request. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

/** PBKDF2 rounds. OWASP's floor for PBKDF2-HMAC-SHA256 is 600k; this is the
 *  knob to raise as hardware gets faster. Stored alongside each hash so old
 *  hashes keep verifying after you raise it. */
const PBKDF2_ROUNDS = 600_000

const encoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function derive(password: string, salt: Uint8Array, rounds: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: rounds, hash: 'SHA-256' },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/** Format: rounds:salt:hash, so the work factor travels with the hash. */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, PBKDF2_ROUNDS)
  return `${PBKDF2_ROUNDS}:${toHex(salt)}:${toHex(hash)}`
}

/** Compare without an early exit, so the time taken does not reveal how many
 *  leading bytes matched. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [rounds, salt, hash] = stored.split(':')
  if (!rounds || !salt || !hash) return false
  const actual = await derive(password, fromHex(salt), Number(rounds))
  return constantTimeEqual(actual, fromHex(hash))
}

// --- users -----------------------------------------------------------------

/**
 * Seeded lazily: hashing is async, and 600k PBKDF2 rounds twice at import would
 * stall the first request. `getUsers()` awaits the same promise every time, so
 * the work happens once.
 */
let usersPromise: Promise<StoredUser[]> | null = null

function getUsers(): Promise<StoredUser[]> {
  usersPromise ??= (async () => [
    { id: 1, email: 'admin@example.com', role: 'admin' as const, passwordHash: await hashPassword('password') },
    { id: 2, email: 'viewer@example.com', role: 'viewer' as const, passwordHash: await hashPassword('password') },
  ])()
  return usersPromise
}

/** Hashed once so an unknown email costs the same work as a known one. Without
 *  it, a fast "no such user" reply enumerates your user list. */
let dummyHashPromise: Promise<string> | null = null
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(crypto.randomUUID())
  return dummyHashPromise
}

/** Public shape - never includes the hash. */
function publicUser(u: StoredUser): User {
  return { id: u.id, email: u.email, role: u.role }
}

/**
 * Check an email/password pair. Returns the user, or null.
 *
 * The same null comes back for an unknown email and a wrong password, and a
 * verify runs either way, so the response neither confirms which emails exist
 * nor answers faster for one case than the other.
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const users = await getUsers()
  const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  const ok = await verifyPassword(password, found?.passwordHash ?? (await getDummyHash()))
  return ok && found ? publicUser(found) : null
}

// --- sessions --------------------------------------------------------------

type Session = { userId: number; expires: number }

const sessions = new Map<string, Session>()

/** Start a session and return its id, to be set as the cookie value. */
export function createSession(userId: number): string {
  // randomUUID is a CSPRNG. A guessable session id is as good as no auth.
  const id = crypto.randomUUID()
  sessions.set(id, { userId, expires: Date.now() + SESSION_TTL_MS })
  return id
}

/** Resolve a session id to its user, sliding the expiry forward. Returns null
 *  for an unknown or expired id, and drops the expired entry. */
export async function userForSession(id: string | undefined): Promise<User | null> {
  if (!id) return null
  const session = sessions.get(id)
  if (!session) return null
  if (session.expires < Date.now()) {
    sessions.delete(id)
    return null
  }
  session.expires = Date.now() + SESSION_TTL_MS
  const users = await getUsers()
  const user = users.find((u) => u.id === session.userId)
  return user ? publicUser(user) : null
}

/** Invalidate a session server-side. Clearing the cookie alone would leave a
 *  stolen id working until it expired. */
export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id)
}

/**
 * Cookie options for the session.
 *
 * `httpOnly` keeps the id away from JavaScript, so an XSS bug cannot read it.
 * `sameSite: 'lax'` blocks the cookie on cross-site POSTs, which is what stops
 * CSRF against the form actions. `secure` is on outside dev, where there is no
 * HTTPS to require.
 */
export function sessionCookieOptions(secure: boolean) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  } as const
}
