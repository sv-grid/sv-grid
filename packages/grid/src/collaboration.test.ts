import { describe, expect, it, vi } from 'vitest'
import {
  broadcastChannelTransport,
  createCollaboration,
  type CollabMessage,
  type CollabTransport,
} from './collaboration'

/** An in-memory bus so two controllers can talk in a test. */
function makeBus() {
  const handlers = new Set<(m: CollabMessage) => void>()
  const transportFor = (): CollabTransport => ({
    post: (msg) => {
      // deliver async-ish to every subscriber except none (real channels echo
      // to other tabs, not self; our controllers ignore their own id anyway).
      for (const h of [...handlers]) h(msg)
    },
    subscribe: (h) => {
      handlers.add(h)
      return () => handlers.delete(h)
    },
  })
  return { transportFor }
}

const userA = { id: 'a', name: 'Ada', color: '#f00' }
const userB = { id: 'b', name: 'Bob', color: '#00f' }

describe('createCollaboration', () => {
  it('peers see each other after hello', () => {
    const bus = makeBus()
    const a = createCollaboration({ user: userA, transport: bus.transportFor() })
    const b = createCollaboration({ user: userB, transport: bus.transportFor() })
    // A is announced; B's hello reaches A; A replies presence.
    expect(a.peers().map((p) => p.id)).toEqual(['b'])
    expect(b.peers().map((p) => p.id)).toEqual(['a'])
    a.dispose()
    b.dispose()
  })

  it('closes the transport channel on dispose (#82)', () => {
    // The controller now forwards dispose to the transport...
    const disposeSpy = vi.fn()
    const collab = createCollaboration({
      user: userA,
      transport: { post: vi.fn(), subscribe: () => () => {}, dispose: disposeSpy },
    })
    collab.dispose()
    expect(disposeSpy).toHaveBeenCalledTimes(1)

    // ...and broadcastChannelTransport.dispose() closes the BroadcastChannel.
    const close = vi.fn()
    class FakeBroadcastChannel {
      postMessage = vi.fn()
      addEventListener = vi.fn()
      removeEventListener = vi.fn()
      close = close
      constructor(public name: string) {}
    }
    const Orig = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel
    ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel
    try {
      broadcastChannelTransport('room').dispose?.()
      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = Orig
    }
  })

  it('setCell propagates a remote cursor', () => {
    const bus = makeBus()
    const onPeers = vi.fn()
    const a = createCollaboration({ user: userA, transport: bus.transportFor(), onPeersChange: onPeers })
    const b = createCollaboration({ user: userB, transport: bus.transportFor() })
    b.setCell({ rowId: 'r1', columnId: 'salary' })
    const peerB = a.peers().find((p) => p.id === 'b')
    expect(peerB?.cell).toEqual({ rowId: 'r1', columnId: 'salary' })
    a.dispose()
    b.dispose()
  })

  it('sendEdit fires onRemoteEdit on the other peer only', () => {
    const bus = makeBus()
    const aEdits = vi.fn()
    const bEdits = vi.fn()
    const a = createCollaboration({ user: userA, transport: bus.transportFor(), onRemoteEdit: aEdits })
    const b = createCollaboration({ user: userB, transport: bus.transportFor(), onRemoteEdit: bEdits })
    a.sendEdit('r2', 'name', 'Grace')
    expect(bEdits).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'r2', columnId: 'name', value: 'Grace' }))
    expect(aEdits).not.toHaveBeenCalled() // not echoed to self
    a.dispose()
    b.dispose()
  })

  it('bye removes a peer', () => {
    const bus = makeBus()
    const a = createCollaboration({ user: userA, transport: bus.transportFor() })
    const b = createCollaboration({ user: userB, transport: bus.transportFor() })
    expect(a.peers()).toHaveLength(1)
    b.dispose()
    expect(a.peers()).toHaveLength(0)
    a.dispose()
  })
})
