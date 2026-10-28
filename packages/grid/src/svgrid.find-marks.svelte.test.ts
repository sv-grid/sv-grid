/**
 * Find (Ctrl+F): every match is marked while the bar is open, the current one
 * more strongly, and a match counts in what the cell shows (the column's
 * formatter) as well as in its raw value.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import type { SvGridApi } from './index'

type Row = { id: number; name: string; owner: string; amount: number }

describe('find marks', () => {
  it('marks every match, the current one apart, and reads displayed text', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: SvGridApi<any, Row> | null = null
    const props = $state({
      data: [
        { id: 1, name: 'Ana', owner: 'u1', amount: 1800 },
        { id: 2, name: 'Ben', owner: 'u2', amount: 2400 },
        { id: 3, name: 'Banana', owner: 'u1', amount: 900 },
      ] as Row[],
      columns: [
        { field: 'name', header: 'Name' },
        // The cell shows a name for the stored id.
        { field: 'owner', header: 'Owner', formatter: ({ value }: { value: unknown }) => (value === 'u1' ? 'Ana Ruiz' : 'Ben Okafor') },
        { field: 'amount', header: 'Amount', formatter: ({ value }: { value: unknown }) => `$${Number(value).toLocaleString('en-US')}` },
      ],
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: SvGridApi<any, Row>) => (api = a),
    })
    const app = mount(SvGrid, { target, props: props as never })
    try {
      flushSync()
      ;(api as unknown as { openFind: () => void }).openFind()
      flushSync()
      // The find bar is its own chunk, loaded on the first open.
      const input = await vi.waitFor(() => {
        flushSync()
        const el = target.querySelector<HTMLInputElement>('.sv-grid-find input')
        if (!el) throw new Error('find bar not loaded yet')
        return el
      })
      input.value = 'ana'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      const hits = () => [...target.querySelectorAll('td.sv-grid-cell-find-hit')].map((td) => td.textContent?.trim())
      // "Ana", "Banana", and the two owners shown as "Ana Ruiz" (stored u1).
      expect(hits()).toEqual(['Ana', 'Ana Ruiz', 'Banana', 'Ana Ruiz'])
      expect(target.querySelectorAll('td.sv-grid-cell-find-current')).toHaveLength(1)

      input.value = '$2,400'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(hits()).toEqual(['$2,400'])
    } finally {
      unmount(app)
      target.remove()
    }
  })
})
