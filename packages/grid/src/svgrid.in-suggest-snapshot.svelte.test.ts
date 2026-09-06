/**
 * The `in` / `notIn` suggestions dropdown shares the facet scan with the
 * filter menu's checklist. That scan now also runs the filter pipeline, to
 * offer only values still reachable under the other columns' filters - which
 * put an O(rows) pass on the typing path of the chip input, because the
 * suggestions re-derive on every keystroke.
 *
 * They are snapshotted per open instead, the same way the menu's checklist is.
 * This pins that: typing must not re-scan.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  rowSortingFeature,
  tableFeatures,
} from './index'
import type { ColumnDef } from './index'

type Row = { id: number; symbol: string }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const tick = () => new Promise<void>((r) => setTimeout(r))

describe('in/notIn suggestions', () => {
  it('scans once per open, not once per keystroke', async () => {
    const data: Row[] = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      symbol: `SYM${String(i).padStart(3, '0')}`,
    }))

    // Count reads of the accessor the facet scan goes through. A per-keystroke
    // re-scan shows up here as another 40 reads per character typed.
    let reads = 0
    const columns: ColumnDef<typeof features, Row>[] = [
      {
        id: 'symbol',
        header: 'Symbol',
        width: 200,
        fieldFn: (row: Row) => {
          reads += 1
          return row.symbol
        },
      },
    ]

    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvGrid<typeof features, Row>, {
      target,
      props: { data, columns, features, filterMode: 'row', height: 300 } as never,
    })
    await tick()

    // Switch the column to `in`, which is what turns the filter-row box into a
    // chip input with suggestions.
    const operatorBtn = target.querySelector(
      '.sv-grid-filter-operator-btn',
    ) as HTMLButtonElement
    operatorBtn.click()
    await vi.waitFor(() => expect(document.querySelector('.sv-grid-operator-menu')).not.toBeNull())
    const inItem = Array.from(
      document.querySelectorAll('.sv-grid-operator-menu .sv-grid-menu-item'),
    ).find((el) => el.textContent?.trim() === 'In') as HTMLElement
    inItem.click()
    await tick()

    const input = target.querySelector(
      '.sv-grid-filter-chip-input, .sv-grid-filter-value',
    ) as HTMLInputElement
    expect(input).not.toBeNull()
    input.focus()
    input.dispatchEvent(new Event('focus', { bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('.sv-grid-in-suggest')).not.toBeNull())

    const afterOpen = reads
    expect(afterOpen).toBeGreaterThan(0)

    // Type into the box: the list narrows from the snapshot, no fresh scan.
    for (const text of ['S', 'SY', 'SYM', 'SYM0', 'SYM00']) {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await tick()
    }
    expect(document.querySelector('.sv-grid-in-suggest')).not.toBeNull()
    expect(reads).toBe(afterOpen)

    unmount(app)
    target.remove()
  })
})
