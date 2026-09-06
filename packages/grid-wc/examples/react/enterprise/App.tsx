import { useRef, useState } from 'react'
import { SvGrid, type SvGridHandle } from '@svgrid/grid-wc/react'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

/**
 * Excel export from a React host.
 *
 * `@svgrid/enterprise/export` is plain JavaScript - no Svelte in your build -
 * so this works in any bundler. The same is true of `/import`, `/print`,
 * `/pivot` and `/license`. The Kanban and scheduler views are the exception:
 * they are Svelte components, so they need a Svelte-aware bundler.
 *
 * The api arrives on the handle once `apiready` has fired. It is typed
 * `unknown` there because the wrapper does not depend on the grid's types, so
 * the enterprise call needs a cast.
 */
export default function App() {
  const grid = useRef<SvGridHandle>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  async function exportXlsx() {
    if (!grid.current?.api) return
    setBusy(true)
    try {
      await exportGrid(grid.current.api as Parameters<typeof exportGrid>[0], {
        format: 'xlsx',
        filename: 'people',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={exportXlsx} disabled={!ready || busy}>
        {busy ? 'Building…' : 'Export to Excel'}
      </button>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid
          ref={grid}
          data={people}
          columns={columns}
          sortable
          filterable
          onApiReady={() => setReady(true)}
        />
      </div>
    </div>
  )
}
