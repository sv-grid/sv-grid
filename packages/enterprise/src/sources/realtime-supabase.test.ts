import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseRealtime } from './realtime-supabase'

/** A supabase-js-like realtime client that captures the wiring and can fire payloads. */
function makeClient() {
  const state: {
    name?: string
    filter?: Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb?: (payload: any) => void
    status?: (s: string) => void
    removed: unknown[]
  } = { removed: [] }

  const channel: any = {
    on(_type: string, filter: Record<string, unknown>, cb: (p: unknown) => void) {
      state.filter = filter
      state.cb = cb
      return channel
    },
    subscribe(cb?: (s: string) => void) {
      state.status = cb
      return channel
    },
  }
  const client = {
    channel(name: string) { state.name = name; return channel },
    removeChannel(ch: unknown) { state.removed.push(ch) },
  }
  return { client, channel, state }
}

afterEach(() => vi.useRealTimers())

describe('createSupabaseRealtime', () => {
  it('subscribes to postgres_changes for the table with defaults', () => {
    const { client, state } = makeClient()
    createSupabaseRealtime({ client, table: 'customers', onChange: () => {} })
    expect(state.name).toBe('svgrid:public:customers')
    expect(state.filter).toEqual({ event: '*', schema: 'public', table: 'customers' })
  })

  it('honors schema, event, filter, and channelName', () => {
    const { client, state } = makeClient()
    createSupabaseRealtime({
      client, table: 't', schema: 'app', event: 'INSERT', filter: 'tier=eq.pro', channelName: 'c', onChange: () => {},
    })
    expect(state.name).toBe('c')
    expect(state.filter).toEqual({ event: 'INSERT', schema: 'app', table: 't', filter: 'tier=eq.pro' })
  })

  it('normalizes a change payload', () => {
    const { client, state } = makeClient()
    const onChange = vi.fn()
    createSupabaseRealtime({ client, table: 't', onChange })
    state.cb!({ eventType: 'UPDATE', new: { id: 1, name: 'X' }, old: { id: 1 } })
    expect(onChange).toHaveBeenCalledWith({ type: 'UPDATE', new: { id: 1, name: 'X' }, old: { id: 1 } })
  })

  it('passes status through', () => {
    const { client, state } = makeClient()
    const onStatus = vi.fn()
    createSupabaseRealtime({ client, table: 't', onChange: () => {}, onStatus })
    state.status!('SUBSCRIBED')
    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED')
  })

  it('coalesces a burst into one call when debounced', () => {
    vi.useFakeTimers()
    const { client, state } = makeClient()
    const onChange = vi.fn()
    createSupabaseRealtime({ client, table: 't', debounceMs: 200, onChange })
    state.cb!({ eventType: 'INSERT', new: { id: 1 } })
    state.cb!({ eventType: 'INSERT', new: { id: 2 } })
    state.cb!({ eventType: 'INSERT', new: { id: 3 } })
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ type: 'INSERT', new: { id: 3 }, old: null })
  })

  it('unsubscribe removes the channel and cancels a pending debounce', () => {
    vi.useFakeTimers()
    const { client, state, channel } = makeClient()
    const onChange = vi.fn()
    const live = createSupabaseRealtime({ client, table: 't', debounceMs: 200, onChange })
    state.cb!({ eventType: 'DELETE', old: { id: 9 } })
    live.unsubscribe()
    vi.advanceTimersByTime(500)
    expect(onChange).not.toHaveBeenCalled()
    expect(state.removed).toEqual([channel])
  })
})
