/**
 * createSupabaseAuth - a tiny reactive controller over Supabase Auth, so a
 * Studio screen can require a signed-in user. You bring the `supabase-js` client
 * (BYO, no dependency); this tracks the session and exposes sign in / up / out.
 * Pair it with `SvAuthGate` to gate the UI, and with Row-Level Security to scope
 * data per user - auth establishes *who*, RLS enforces *what they can see*.
 *
 *     const auth = createSupabaseAuth({ client, onChange: (s) => (authState = s) })
 *     await auth.signIn(email, password)
 *     // ... auth.signOut(); auth.dispose() on unmount
 */
import { nudgeEnterprise } from '../license'

export type AuthUser = { id: string; email?: string }

export type AuthState = {
  /** The signed-in user, or null. */
  user: AuthUser | null
  /** True during the initial session check or an in-flight auth call. */
  loading: boolean
  /** Last auth error message, or null. */
  error: string | null
}

type Session = { user: { id: string; email?: string } } | null

/** The slice of a `supabase-js` client's `auth` this needs. */
export type SupabaseAuthClientLike = {
  auth: {
    getSession(): Promise<{ data: { session: Session } }>
    onAuthStateChange(cb: (event: string, session: Session) => void): {
      data: { subscription: { unsubscribe(): void } }
    }
    signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>
    signUp(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>
    signOut(): Promise<{ error: { message: string } | null }>
  }
}

export type SupabaseAuthConfig = {
  client: SupabaseAuthClientLike
  onChange: (state: AuthState) => void
}

export type SupabaseAuthController = {
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  getState(): AuthState
  dispose(): void
}

const userOf = (session: Session): AuthUser | null =>
  session?.user ? { id: session.user.id, email: session.user.email } : null

export function createSupabaseAuth(config: SupabaseAuthConfig): SupabaseAuthController {
  nudgeEnterprise('Studio') // soft-gate; never blocks
  let state: AuthState = { user: null, loading: true, error: null }
  const emit = () => config.onChange({ ...state })
  const set = (patch: Partial<AuthState>) => {
    state = { ...state, ...patch }
    emit()
  }

  emit() // initial loading state

  // Resolve the current session, then keep it in sync.
  config.client.auth.getSession().then(({ data }) => set({ user: userOf(data.session), loading: false }))
  const sub = config.client.auth.onAuthStateChange((_event, session) =>
    set({ user: userOf(session), loading: false }),
  )

  const run = async (op: () => Promise<{ error: { message: string } | null }>) => {
    set({ loading: true, error: null })
    const { error } = await op()
    // On success the user arrives via onAuthStateChange; just clear loading.
    set(error ? { loading: false, error: error.message } : { loading: false })
  }

  return {
    signIn: (email, password) => run(() => config.client.auth.signInWithPassword({ email, password })),
    signUp: (email, password) => run(() => config.client.auth.signUp({ email, password })),
    signOut: () => run(() => config.client.auth.signOut()),
    getState: () => ({ ...state }),
    dispose: () => sub.data.subscription.unsubscribe(),
  }
}
