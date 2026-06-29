import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  broadcastChannelTransport,
  createCollaboration,
  type CollabMessage,
  type CollabTransport,
} from './collaboration'

const userA = { id: 'a', name: 'Ada', color: '#f00' }
const userB = { id: 'b', name: 'Bob', color: '#00f' }

/** A controllable transport whose subscriber we can drive by hand. */
function manualTransport() {
  const handlers = new Set<(m: CollabMessage) => void>()
  const posted: CollabMessage[] = []
  const transport: CollabTransport = {
    post: (msg) => {
      posted.push(msg)
    },
    subscribe: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  }
  const deliver = (msg: CollabMessage) => {
    for (const h of [...handlers]) h(msg)
  }
  return { transport, posted, deliver, handlers }
}

describe('createCollaboration - presence / edit upserts', () => {
  it('hello reply carries the responder own cell', () => {
    const t = manualTransport()
    const a = createCollaboration({ user: userA, transport: t.transport })
    a.setCell({ rowId: 'r0', columnId: 'c0' })
    t.posted.length = 0
    // a newcomer says hello -> A replies presence with its own cell.
    t.deliver({ kind: 'hello', user: userB })
    const reply = t.posted.find((m) => m.kind === 'presence')
    expect(reply).toEqual({ kind: 'presence', user: userA, cell: { rowId: 'r0', columnId: 'c0' } })
    expect(a.peers().map((p) => p.id)).toEqual(['b'])
    a.dispose()
  })

  it('presence message records the peer cursor', () => {
    const t = manualTransport()
    const onPeersChange = vi.fn()
    const a = createCollaboration({ user: userA, transport: t.transport, onPeersChange })
    t.deliver({ kind: 'presence', user: userB, cell: { rowId: 'r9', columnId: 'name' } })
    expect(a.peers()[0]?.cell).toEqual({ rowId: 'r9', columnId: 'name' })
    expect(onPeersChange).toHaveBeenCalled()
    a.dispose()
  })

  it('edit from another peer sets a cursor AND fires onRemoteEdit', () => {
    const t = manualTransport()
    const onRemoteEdit = vi.fn()
    const a = createCollaboration({ user: userA, transport: t.transport, onRemoteEdit })
    t.deliver({ kind: 'edit', user: userB, rowId: 'r1', columnId: 'age', value: 30 })
    expect(a.peers()[0]?.cell).toEqual({ rowId: 'r1', columnId: 'age' })
    expect(onRemoteEdit).toHaveBeenCalledWith({
      rowId: 'r1',
      columnId: 'age',
      value: 30,
      user: userB,
    })
    a.dispose()
  })

  it('ignores own id on upsert (presence/edit echoed back)', () => {
    const t = manualTransport()
    const onRemoteEdit = vi.fn()
    const a = createCollaboration({ user: userA, transport: t.transport, onRemoteEdit })
    // self-echo: should not appear as a peer and should not call onRemoteEdit
    t.deliver({ kind: 'presence', user: userA, cell: { rowId: 'x', columnId: 'y' } })
    t.deliver({ kind: 'edit', user: userA, rowId: 'x', columnId: 'y', value: 1 })
    expect(a.peers()).toHaveLength(0)
    expect(onRemoteEdit).not.toHaveBeenCalled()
    a.dispose()
  })

  it('bye for an unknown peer does not notify', () => {
    const t = manualTransport()
    const onPeersChange = vi.fn()
    const a = createCollaboration({ user: userA, transport: t.transport, onPeersChange })
    onPeersChange.mockClear()
    t.deliver({ kind: 'bye', userId: 'ghost' })
    expect(onPeersChange).not.toHaveBeenCalled()
    a.dispose()
  })

  it('setCell broadcasts a presence with the new cell', () => {
    const t = manualTransport()
    const a = createCollaboration({ user: userA, transport: t.transport })
    t.posted.length = 0
    a.setCell(null)
    expect(t.posted).toContainEqual({ kind: 'presence', user: userA, cell: null })
    a.dispose()
  })

  it('sendEdit broadcasts an edit message', () => {
    const t = manualTransport()
    const a = createCollaboration({ user: userA, transport: t.transport })
    t.posted.length = 0
    a.sendEdit('r5', 'col', 'v')
    expect(t.posted).toContainEqual({
      kind: 'edit',
      user: userA,
      rowId: 'r5',
      columnId: 'col',
      value: 'v',
    })
    a.dispose()
  })

  it('drops messages after dispose and unsubscribes', () => {
    const t = manualTransport()
    const onPeersChange = vi.fn()
    const a = createCollaboration({ user: userA, transport: t.transport, onPeersChange })
    a.dispose()
    onPeersChange.mockClear()
    // After dispose the handler is unsubscribed; even if delivered it no-ops.
    t.deliver({ kind: 'hello', user: userB })
    expect(onPeersChange).not.toHaveBeenCalled()
    expect(a.peers()).toHaveLength(0)
    // second dispose is a no-op
    a.dispose()
  })
})

describe('createCollaboration - prune timer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('prunes peers gone silent past the timeout', () => {
    const t = manualTransport()
    const onPeersChange = vi.fn()
    const a = createCollaboration({
      user: userA,
      transport: t.transport,
      onPeersChange,
      peerTimeoutMs: 3000,
    })
    t.deliver({ kind: 'presence', user: userB, cell: null })
    expect(a.peers()).toHaveLength(1)
    onPeersChange.mockClear()
    // advance past the timeout; prune interval is max(1000, timeout/3) = 1000
    vi.advanceTimersByTime(4000)
    expect(a.peers()).toHaveLength(0)
    expect(onPeersChange).toHaveBeenCalled()
    a.dispose()
  })

  it('prune tick with no expired peers does not notify', () => {
    const t = manualTransport()
    const onPeersChange = vi.fn()
    const a = createCollaboration({
      user: userA,
      transport: t.transport,
      onPeersChange,
      peerTimeoutMs: 9000,
    })
    t.deliver({ kind: 'presence', user: userB, cell: null })
    onPeersChange.mockClear()
    vi.advanceTimersByTime(3000) // one tick, peer still fresh
    expect(onPeersChange).not.toHaveBeenCalled()
    expect(a.peers()).toHaveLength(1)
    a.dispose()
  })

  it('dispose clears the prune timer', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const t = manualTransport()
    const a = createCollaboration({ user: userA, transport: t.transport })
    a.dispose()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})

describe('broadcastChannelTransport', () => {
  it('round-trips a message across two channels of the same name', async () => {
    const tx = broadcastChannelTransport('svgrid-test-chan')
    const rx = broadcastChannelTransport('svgrid-test-chan')
    const received: CollabMessage[] = []
    const off = rx.subscribe((m) => received.push(m))
    tx.post({ kind: 'hello', user: userA })
    // BroadcastChannel delivery is async (microtask/macrotask).
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toContainEqual({ kind: 'hello', user: userA })
    off()
  })

  it('subscribe returns a working unsubscribe', async () => {
    const tx = broadcastChannelTransport('svgrid-unsub-chan')
    const rx = broadcastChannelTransport('svgrid-unsub-chan')
    const received: CollabMessage[] = []
    const off = rx.subscribe((m) => received.push(m))
    off()
    tx.post({ kind: 'bye', userId: 'a' })
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toHaveLength(0)
  })

  it('no-ops gracefully when BroadcastChannel is unavailable', () => {
    const original = globalThis.BroadcastChannel
    // @ts-expect-error - simulate SSR / old environment
    delete globalThis.BroadcastChannel
    try {
      const tx = broadcastChannelTransport('nope')
      const handler = vi.fn()
      const off = tx.subscribe(handler)
      expect(() => tx.post({ kind: 'bye', userId: 'x' })).not.toThrow()
      expect(() => off()).not.toThrow()
      expect(handler).not.toHaveBeenCalled()
    } finally {
      globalThis.BroadcastChannel = original
    }
  })
})
