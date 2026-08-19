/**
 * The footer's page-size control used to import SvGridDropdown statically.
 * That pulled a ~22 KB component into the base bundle to pick one of four
 * numbers, and worse, it gave the bundler a static path to a module that
 * SvGrid.svelte deliberately loads with `import()` as a cell editor. The lazy
 * boundary silently stopped existing: the dropdown shipped in base and the
 * dynamic import resolved to the already-bundled copy.
 *
 * The footer now renders the dropdown's closed trigger as plain markup and
 * fetches the real component on first open. These tests pin the two things
 * that regression would break: the trigger must look and read the same before
 * any load, and clicking it must actually open the list rather than requiring
 * a second click once the chunk arrives.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, rowPaginationFeature, tableFeatures } from './index'
import type { ColumnDef } from './index'

type Row = { id: number; name: string }
const features = tableFeatures({ rowPaginationFeature })
const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const cols: ColumnDef<typeof features, Row>[] = [{ field: 'name', header: 'Name', width: 160 }]

const tick = () => new Promise<void>((r) => setTimeout(r))

function mountGrid(target: HTMLElement) {
  return mount(SvGrid<typeof features, Row>, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      showPagination: true,
      pageSize: 10,
      getCoreRowModel: createCoreRowModel(),
    } as never,
  })
}

const trigger = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>(
    '.sv-grid-pagination-pagesize-dd .sv-grid-dropdown-trigger',
  )

describe('footer page-size control', () => {
  it('renders a dropdown trigger without loading SvGridDropdown', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = mountGrid(host)
    await tick()

    const btn = trigger(host)
    expect(btn).not.toBeNull()
    // Same classes and ARIA as the real component's closed state, so swapping
    // it in causes no visual change and no layout shift.
    expect(btn!.getAttribute('aria-haspopup')).toBe('listbox')
    expect(btn!.getAttribute('aria-expanded')).toBe('false')
    expect(btn!.querySelector('.sv-grid-dropdown-label')?.textContent?.trim()).toBe('10')
    expect(btn!.querySelector('.sv-grid-dropdown-caret')).not.toBeNull()
    // Nothing is open until the user asks for it.
    expect(host.querySelector('[role="listbox"]')).toBeNull()

    unmount(app)
    host.remove()
  })

  it('opens on the first click, without needing a second one', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = mountGrid(host)
    await tick()

    trigger(host)!.click()
    // The component is fetched here; give the dynamic import a turn to settle.
    for (let i = 0; i < 10 && !document.querySelector('[role="listbox"]'); i++) await tick()

    // autoOpen carries the originating click through to an open panel.
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    expect(trigger(host)!.getAttribute('aria-expanded')).toBe('true')

    unmount(app)
    host.remove()
  })
})
