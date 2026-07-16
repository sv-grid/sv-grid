import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth, type AuthState } from './auth-supabase'

/** A supabase-js-like auth client with controllable session + spies. */
function makeClient(initialSession: { user: { id: string; email?: string } } | null = null) {
  let cb: ((event: string, session: unknown) => void) | undefined
  const unsubscribe = vi.fn()
  type AuthResult = { error: { message: string } | null }
  const ok = async (): Promise<AuthResult> => ({ error: null })
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: initialSession } })),
      onAuthStateChange: vi.fn((fn: (e: string, s: unknown) => void) => {
        cb = fn
        return { data: { subscription: { unsubscribe } } }
      }),
      signInWithPassword: vi.fn(ok),
      signUp: vi.fn(ok),
      signOut: vi.fn(ok),
    },
  }
  return { client, unsubscribe, fire: (session: unknown) => cb?.('x', session) }
}

const track = () => {
  const states: AuthState[] = []
  return { states, onChange: (s: AuthState) => states.push(s) }
}

describe('createSupabaseAuth', () => {
  it('resolves the current session on init', async () => {
    const { client } = makeClient({ user: { id: 'u1', email: 'a@b.co' } })
    const { states, onChange } = track()
    createSupabaseAuth({ client, onChange })
    await vi.waitFor(() => expect(states.at(-1)?.user).toEqual({ id: 'u1', email: 'a@b.co' }))
    expect(states.at(-1)?.loading).toBe(false)
  })

  it('starts in a loading, signed-out state', () => {
    const { client } = makeClient(null)
    const { states, onChange } = track()
    createSupabaseAuth({ client, onChange })
    expect(states[0]).toEqual({ user: null, loading: true, error: null })
  })

  it('updates when auth state changes (sign in elsewhere)', async () => {
    const { client, fire } = makeClient(null)
    const { states, onChange } = track()
    createSupabaseAuth({ client, onChange })
    await vi.waitFor(() => expect(states.at(-1)?.loading).toBe(false))
    fire({ user: { id: 'u2', email: 'x@y.co' } })
    expect(states.at(-1)?.user).toEqual({ id: 'u2', email: 'x@y.co' })
  })

  it('signIn calls signInWithPassword and surfaces errors', async () => {
    const { client } = makeClient(null)
    client.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'bad creds' } })
    const { states, onChange } = track()
    const auth = createSupabaseAuth({ client, onChange })
    await auth.signIn('a@b.co', 'pw')
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' })
    expect(states.at(-1)).toMatchObject({ error: 'bad creds', loading: false })
  })

  it('signUp and signOut call through', async () => {
    const { client } = makeClient(null)
    const auth = createSupabaseAuth({ client, onChange: () => {} })
    await auth.signUp('a@b.co', 'pw')
    await auth.signOut()
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw' })
    expect(client.auth.signOut).toHaveBeenCalled()
  })

  it('dispose unsubscribes from auth changes', () => {
    const { client, unsubscribe } = makeClient(null)
    const auth = createSupabaseAuth({ client, onChange: () => {} })
    auth.dispose()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
