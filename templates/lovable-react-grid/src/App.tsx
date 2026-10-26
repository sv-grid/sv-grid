import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DataGrid } from './components/DataGrid'
import { makeOrders, REGIONS, STATUSES, type Order } from './lib/orders'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// Same column shape as the Svelte <SvGrid>; the web component forwards it as is.
const columns = [
  { field: 'id', header: 'Order', width: 110 },
  { field: 'customer', header: 'Customer', editorType: 'text', width: 170 },
  { field: 'region', header: 'Region', editorType: 'select', editorOptions: REGIONS, width: 150 },
  { field: 'product', header: 'Product', width: 150 },
  { field: 'status', header: 'Status', editorType: 'select', editorOptions: STATUSES, width: 120 },
  { field: 'quantity', header: 'Qty', editorType: 'number', align: 'right', width: 80, aggregate: 'sum' },
  {
    field: 'amount',
    header: 'Amount',
    editorType: 'number',
    align: 'right',
    width: 130,
    aggregate: 'sum',
    format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
  },
  { field: 'orderedOn', header: 'Ordered', editorType: 'date', width: 130 },
  { field: 'priority', header: 'Priority', editorType: 'checkbox', align: 'center', width: 90 },
]

const groupings: Array<[string, string[]]> = [
  ['No grouping', []],
  ['By status', ['status']],
  ['By region', ['region']],
  ['Region, then status', ['region', 'status']],
]

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => makeOrders())
  const [selected, setSelected] = useState<Order[]>([])
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      // Storage blocked (private mode). The toggle still works for this tab.
    }
  }, [dark])

  const revenue = useMemo(() => orders.reduce((sum, o) => (o.status === 'Refunded' ? sum : sum + o.amount), 0), [orders])
  const selectedTotal = selected.reduce((sum, o) => sum + o.amount, 0)

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Orders</h1>
          <p style={styles.muted}>Sort, filter, double-click a cell to edit, tick rows to total them.</p>
        </div>
        <button type="button" style={styles.button} onClick={() => setDark((d) => !d)}>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <section style={styles.stats} aria-label="Summary">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Revenue (excl. refunds)" value={usd.format(revenue)} />
        <Stat label="Selected" value={selected.length ? `${selected.length} · ${usd.format(selectedTotal)}` : 'none'} />
      </section>

      <div style={styles.toolbar} role="group" aria-label="Group rows">
        {groupings.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => setGroupBy(value)}
            style={{ ...styles.button, ...(groupBy.join() === value.join() ? styles.active : null) }}
          >
            {label}
          </button>
        ))}
      </div>

      <DataGrid
        height={560}
        data={orders}
        columns={columns}
        getRowId={(row: Order) => row.id}
        sortable
        filterable
        editable
        groupable
        groupBy={groupBy}
        pageable
        pageSize={25}
        pageSizeOptions={[25, 50, 100]}
        showRowSelection
        onRowSelectionChange={(e) => setSelected(e.rows as Order[])}
        onCellValueChange={(e) => {
          // The grid reports the edit; you apply it. Your save call goes here.
          const id = (e.row as Order).id
          setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, [e.columnId]: e.newValue } : o)))
        }}
      />
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</span>
      <strong style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  )
}

const styles = {
  main: { display: 'flex', flexDirection: 'column', gap: 16, padding: 24, maxWidth: 1280, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  muted: { margin: 0, fontSize: 14, color: 'var(--muted-foreground)' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  stat: { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', background: 'var(--muted)' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  button: {
    font: 'inherit',
    fontSize: 13,
    padding: '6px 12px',
    borderRadius: 'calc(var(--radius) - 2px)',
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    cursor: 'pointer',
  },
  active: { borderColor: 'var(--primary)', fontWeight: 600 },
} satisfies Record<string, CSSProperties>
