import { useState } from 'react'
import { SvGrid } from '@svgrid/grid-wc/react'
import { people, columns } from '../data'

/**
 * Theming through `--sg-*` custom properties.
 *
 * They are ordinary CSS custom properties, so they cascade: set them on any
 * ancestor and the grid inherits. That is also why they reach into
 * `<sv-grid-shadow>` - inheritance crosses a shadow boundary.
 */
const THEMES = {
  Light: {},
  Dark: {
    '--sg-bg': '#0b1220',
    '--sg-fg': '#e2e8f0',
    '--sg-border': '#1e293b',
    '--sg-header-bg': '#111a2e',
    '--sg-row-hover': '#111a2e',
  },
  Warm: {
    '--sg-bg': '#fffaf5',
    '--sg-fg': '#42302a',
    '--sg-border': '#f0dcc9',
    '--sg-header-bg': '#fdf1e4',
    '--sg-accent': '#c2410c',
  },
} satisfies Record<string, Record<string, string>>

export default function App() {
  const [theme, setTheme] = useState<keyof typeof THEMES>('Light')

  return (
    <div
      style={{
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...THEMES[theme],
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((name) => (
          <button
            key={name}
            onClick={() => setTheme(name)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: theme === name ? '#e2e8f0' : '#fff',
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SvGrid data={people} columns={columns} sortable filterable zebraRows />
      </div>
    </div>
  )
}
