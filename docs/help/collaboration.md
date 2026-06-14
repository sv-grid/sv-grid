# Real-time collaboration

Two people (or two AI agents) on the same grid: **presence** (who's here and
where their cursor is) and **live edits** (a change in one client appears in
every other). SvGrid packages this as a headless controller over a pluggable
transport - the only infrastructure-specific piece.

```ts
import { createCollaboration, broadcastChannelTransport } from 'sv-grid-community'

const collab = createCollaboration({
  user: { id: myId, name: 'Ada', color: '#ef4444' },
  transport: broadcastChannelTransport('my-grid-room'),
  onPeersChange: (peers) => renderCursors(peers),
  onRemoteEdit: ({ rowId, columnId, value }) => applyEdit(rowId, columnId, value),
})
```

Wire it to the grid:

```svelte
<SvGrid {data} {columns} editable getRowId={(r) => r.id}
  onActiveCellChange={(c) => collab.setCell({ rowId: data[c.rowIndex].id, columnId: c.columnId })}
  onCellValueChange={(e) => collab.sendEdit(data[e.rowIndex].id, e.columnId, e.newValue)} />
```

## The transport

The controller is transport-agnostic. It ships with one adapter:

- **`broadcastChannelTransport(name)`** - syncs across tabs of the same
  browser with **zero backend**. Great for demos and single-user multi-tab.

For cross-machine collaboration implement `CollabTransport` (a `post(msg)` +
`subscribe(handler)` pair) over a WebSocket, WebRTC datachannel, or a CRDT
library:

```ts
const wsTransport: CollabTransport = {
  post: (msg) => socket.send(JSON.stringify(msg)),
  subscribe: (h) => { const l = (e) => h(JSON.parse(e.data)); socket.addEventListener('message', l); return () => socket.removeEventListener('message', l) },
}
```

## The controller API

| Method                      | Does                                            |
| --------------------------- | ----------------------------------------------- |
| `setCell(cell \| null)`     | Broadcast where your cursor is.                 |
| `sendEdit(rowId, col, val)` | Broadcast a cell edit.                          |
| `peers()`                   | Present peers (excludes you), with their cursor.|
| `dispose()`                 | Announce leave + tear down (call on unmount).   |

`onPeersChange` fires whenever the peer set or any cursor moves; `onRemoteEdit`
fires for edits from **other** users only (never echoes your own).

## Notes

- Presence is heartbeat-pruned: a peer that closes its tab without a clean
  `bye` is dropped after `peerTimeoutMs` (default 15s).
- Edits are last-writer-wins at the cell level. For conflict-free merging on a
  busy doc, back the transport with a CRDT; the controller doesn't assume one.
- This is also the **multi-agent** substrate: an AI agent is just another peer
  posting `edit` messages - drive `sendEdit` from your agent loop.

See the live [Real-time collaboration](https://sv-grid.com/demos/149-realtime-collaboration)
demo (open it in two tabs).
