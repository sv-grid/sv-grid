/**
 * Real-time collaboration. Presence (who else is here + where their cursor
 * is) and live edits (a change in one client lands in every other), over a
 * pluggable transport. The transport is the only thing tied to infrastructure
 * - swap `broadcastChannelTransport` (same-browser tabs, zero backend) for a
 * WebSocket / WebRTC / CRDT adapter and the controller is unchanged.
 *
 * This is also the natural "multiple agents on one grid" substrate: an AI
 * agent is just another peer posting `edit` messages.
 */
export type CollabUser = {
  id: string
  name: string
  /** A CSS color for this user's cursor / avatar. */
  color: string
}

export type CollabCell = { rowId: string; columnId: string }

export type CollabPresence = CollabUser & {
  cell: CollabCell | null
  /** Last time we heard from this peer (ms). Used to prune the gone. */
  ts: number
}

export type CollabMessage =
  | { kind: 'hello'; user: CollabUser }
  | { kind: 'presence'; user: CollabUser; cell: CollabCell | null }
  | { kind: 'edit'; user: CollabUser; rowId: string; columnId: string; value: unknown }
  | { kind: 'bye'; userId: string }

export type CollabTransport = {
  post(msg: CollabMessage): void
  subscribe(handler: (msg: CollabMessage) => void): () => void
}

export type Collaboration = {
  /** Broadcast where this user's cursor is (or null when it leaves). */
  setCell(cell: CollabCell | null): void
  /** Broadcast a cell edit to every peer. */
  sendEdit(rowId: string, columnId: string, value: unknown): void
  /** The peers currently present (excludes self). */
  peers(): CollabPresence[]
  dispose(): void
}

export type CollaborationOptions = {
  user: CollabUser
  transport: CollabTransport
  /** Fired (with self excluded) whenever the peer set or a cursor changes. */
  onPeersChange?: (peers: CollabPresence[]) => void
  /** Fired when another user edits a cell - apply it to your data. */
  onRemoteEdit?: (edit: {
    rowId: string
    columnId: string
    value: unknown
    user: CollabUser
  }) => void
  /** Drop peers we haven't heard from in this many ms. Default 15000. */
  peerTimeoutMs?: number
}

/** BroadcastChannel transport - live across tabs of the same browser, no
 *  backend. No-ops where BroadcastChannel is unavailable (SSR / old env). */
export function broadcastChannelTransport(name: string): CollabTransport {
  const available = typeof BroadcastChannel !== 'undefined'
  const channel = available ? new BroadcastChannel(name) : null
  return {
    post(msg) {
      channel?.postMessage(msg)
    },
    subscribe(handler) {
      if (!channel) return () => {}
      const listener = (e: MessageEvent) => handler(e.data as CollabMessage)
      channel.addEventListener('message', listener)
      return () => channel.removeEventListener('message', listener)
    },
  }
}

export function createCollaboration(options: CollaborationOptions): Collaboration {
  const { user, transport } = options
  const timeout = options.peerTimeoutMs ?? 15_000
  const peers = new Map<string, CollabPresence>()
  let ownCell: CollabCell | null = null
  let disposed = false

  const list = () => [...peers.values()].sort((a, b) => a.name.localeCompare(b.name))
  const notify = () => options.onPeersChange?.(list())

  function upsert(u: CollabUser, cell: CollabCell | null) {
    if (u.id === user.id) return
    peers.set(u.id, { ...u, cell, ts: Date.now() })
    notify()
  }

  const unsubscribe = transport.subscribe((msg) => {
    if (disposed) return
    switch (msg.kind) {
      case 'hello':
        upsert(msg.user, null)
        // Let the newcomer know we're here (and where our cursor is).
        transport.post({ kind: 'presence', user, cell: ownCell })
        break
      case 'presence':
        upsert(msg.user, msg.cell)
        break
      case 'edit':
        upsert(msg.user, { rowId: msg.rowId, columnId: msg.columnId })
        if (msg.user.id !== user.id) {
          options.onRemoteEdit?.({
            rowId: msg.rowId,
            columnId: msg.columnId,
            value: msg.value,
            user: msg.user,
          })
        }
        break
      case 'bye':
        if (peers.delete(msg.userId)) notify()
        break
    }
  })

  // Prune peers that went silent (closed tab without a `bye`).
  const pruneTimer =
    typeof setInterval !== 'undefined'
      ? setInterval(() => {
          const now = Date.now()
          let changed = false
          for (const [id, p] of peers) {
            if (now - p.ts > timeout) {
              peers.delete(id)
              changed = true
            }
          }
          if (changed) notify()
        }, Math.max(1000, timeout / 3))
      : null

  // Announce ourselves.
  transport.post({ kind: 'hello', user })

  return {
    setCell(cell) {
      ownCell = cell
      transport.post({ kind: 'presence', user, cell })
    },
    sendEdit(rowId, columnId, value) {
      transport.post({ kind: 'edit', user, rowId, columnId, value })
    },
    peers: list,
    dispose() {
      if (disposed) return
      disposed = true
      transport.post({ kind: 'bye', userId: user.id })
      unsubscribe()
      if (pruneTimer) clearInterval(pruneTimer)
    },
  }
}
