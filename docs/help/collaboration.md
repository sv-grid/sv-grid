# Real-time collaboration

Two people (or two AI agents) on the same grid: **presence** (who's here and
where their cursor is) and **live edits** (a change in one client appears in
every other). SvGrid packages this as a headless controller over a pluggable
transport - the only infrastructure-specific piece.

```ts
import { createCollaboration, broadcastChannelTransport } from '@svgrid/grid'

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

See the live [Real-time collaboration](https://svgrid.com/demos/149-realtime-collaboration/)
demo (open it in two tabs).

## Try it

There is no `collab` prop: collaboration is a pattern you assemble from the
grid's own callbacks. This wires the local half of it - the cursor broadcast -
against a stub transport, so you can see the shape without a server.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; department: string; salary: number }

  const data: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    salary: 155000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190, editorType: 'text' },
    { field: 'department', header: 'Department', width: 160, editorType: 'text' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number' },
  ]

  // Stands in for the transport. A real one is a WebSocket or a Yjs awareness
  // channel; the grid does not care which, it only produces the events.
  let broadcast = $state<string[]>([])
  const send = (line: string) => (broadcast = [line, ...broadcast].slice(0, 5))
</script>

<SvGrid
  {data}
  {columns}
  editable
  onActiveCellChange={(cell) => send('cursor -> row ' + cell.rowIndex + ', ' + cell.columnId)}
  onCellValueChange={(e) => send('edit -> ' + e.columnId + ' = ' + String(e.newValue))}
/>

<p>Would be broadcast to peers:</p>
<ul>
  {#each broadcast as line}<li><code>{line}</code></li>{/each}
</ul>
```

Everything a peer needs is in those two callbacks. The half this page cannot
demonstrate in one browser tab is the receiving side - rendering other people's
cursors - which is the controller API above.
