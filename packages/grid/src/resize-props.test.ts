/**
 * The `columnResize` / `rowResize` props, against a REAL mounted `<SvGrid>`.
 *
 * Both default to OFF and both are opt-in, so they are tested together and the
 * last block asserts they behave identically.
 *
 * Two things make "the prop is on" and "the affordance exists" separate claims
 * here, and both are why these tests double-`settle()`:
 *
 *   - Neither affordance is rendered by the component. Each is injected by an
 *     action through a MutationObserver.
 *   - Neither action is imported statically. Both arrive via `import()`, so the
 *     handles land a microtask after the first paint.
 *
 * `columnResize` off-by-default is a deliberate behaviour CHANGE - column
 * resizing used to be unconditional - so the assertion pinning that is load
 * bearing, not a restatement of the obvious.
 *
 * jsdom does no layout, so the drag arithmetic is only sanity-checked here; it
 * is covered properly against synthetic DOM in row-resize.test.ts and
 * column-resize.test.ts. What this file checks is the wiring.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { tableFeatures, createCoreRowModel } from './index'
import type { ColumnDef } from './index'

type Row = { id: string; name: string; team: string }

const features = tableFeatures({})

const rows: Row[] = [
  { id: 'r1', name: 'Ada Lovelace', team: 'Platform' },
  { id: 'r2', name: 'Grace Hopper', team: 'Compilers' },
  { id: 'r3', name: 'Barbara Liskov', team: 'Platform' },
]

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 140 },
]

const mounted: Array<() => void> = []

function mountGrid(extraProps: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      _rowModels: { coreRowModel: createCoreRowModel() },
      containerHeight: 300,
      // Virtualization off so every row is in the DOM to be counted.
      virtualization: false,
      columnVirtualization: false,
      ...extraProps,
    } as never,
  })
  mounted.push(() => {
    unmount(app)
    target.remove()
  })
  return target
}

/** Let the row model + effects settle before reading the DOM. */
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  while (mounted.length) mounted.pop()!()
  document.body.innerHTML = ''
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function () {}
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = function () {}
  }
})

const handles = (t: HTMLElement) => t.querySelectorAll('.sv-grid-resize-handle').length
const strips = (t: HTMLElement) => t.querySelectorAll('.sv-grid-row-resize-handle').length

describe('columnResize prop', () => {
  it('injects no handles when the prop is absent', async () => {
    const target = mountGrid()
    await settle()
    await settle()
    // Off by default. Column resizing used to be unconditional, so this is the
    // assertion that pins the deliberate behaviour change.
    expect(handles(target)).toBe(0)
  })

  it('injects a handle per column when true', async () => {
    const target = mountGrid({ columnResize: true })
    await settle()
    // The action is fetched through import(), so the handles land a tick later
    // than the first paint - a second settle, not a rendering bug.
    await settle()
    expect(handles(target)).toBe(cols.length)
  })

  it('injects no handles when explicitly false', async () => {
    const target = mountGrid({ columnResize: false })
    await settle()
    await settle()
    expect(handles(target)).toBe(0)
  })

  it('leaves the headers themselves intact when off', async () => {
    // Only the drag affordance is absent - the column still renders, still
    // sorts, still has its accessible name.
    const target = mountGrid({ columnResize: false })
    await settle()
    expect(target.querySelectorAll('.sv-grid-column').length).toBeGreaterThanOrEqual(cols.length)
    expect(target.textContent).toContain('Name')
    expect(target.textContent).toContain('Team')
  })

  it('applies a dragged width to the column', async () => {
    const target = mountGrid({ columnResize: true })
    await settle()
    await settle()

    const handle = target.querySelector<HTMLElement>('.sv-grid-resize-handle')!
    const th = handle.closest<HTMLElement>('th.sv-grid-column')!
    const opts = { bubbles: true, cancelable: true, pointerId: 1 }
    handle.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 0 } as PointerEventInit))
    window.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 60 } as PointerEventInit))
    await settle()

    // Name starts at 200 (see `cols`), so a +60 drag lands at 260.
    expect(th.style.width).toContain('260')
  })
})

describe('rowResize prop', () => {
  it('injects no strips when the prop is absent', async () => {
    const target = mountGrid()
    await settle()
    expect(strips(target)).toBe(0)
  })

  it('injects a strip per body row when on', async () => {
    const target = mountGrid({ rowResize: true })
    await settle()
    // The MutationObserver decorates asynchronously; give it a turn.
    await settle()
    expect(strips(target)).toBe(rows.length)
  })

  it('works without a gutter column, via the row anchor', async () => {
    // No showRowNumbers, no `sv-row-gutter` cellClass. Before the anchor
    // fallback this rendered zero strips and the prop did nothing at all.
    const target = mountGrid({ rowResize: true })
    await settle()
    await settle()
    const first = target.querySelector<HTMLElement>('.sv-grid-row-resize-handle')
    expect(first).not.toBeNull()
    expect(first!.closest('td')).not.toBeNull()
  })

  it('gives each strip a keyboard-reachable separator role', async () => {
    const target = mountGrid({ rowResize: true })
    await settle()
    await settle()
    const strip = target.querySelector<HTMLElement>('.sv-grid-row-resize-handle')!
    expect(strip.getAttribute('role')).toBe('separator')
    expect(strip.getAttribute('aria-orientation')).toBe('horizontal')
    expect(strip.tabIndex).toBe(0)
  })

  it('is suppressed by autoRowHeight, which owns the height itself', async () => {
    // Both want to set the row height. Letting them both run means the next
    // measurement pass silently discards whatever the user dragged.
    const target = mountGrid({ rowResize: true, autoRowHeight: true })
    await settle()
    await settle()
    expect(strips(target)).toBe(0)
  })

  it('applies a dragged height to the row', async () => {
    const target = mountGrid({ rowResize: true, rowHeight: 30 })
    await settle()
    await settle()

    const strip = target.querySelector<HTMLElement>('.sv-grid-row-resize-handle')!
    const tr = strip.closest<HTMLTableRowElement>('tr.sv-grid-row')!
    // jsdom reports a zero rect, so the drag needs a real starting height.
    tr.getBoundingClientRect = () =>
      ({ height: 30, width: 300, top: 0, left: 0, right: 300, bottom: 30, x: 0, y: 0, toJSON() {} }) as DOMRect

    const opts = { bubbles: true, cancelable: true, pointerId: 1 }
    strip.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientY: 0 } as PointerEventInit))
    window.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientY: 44 } as PointerEventInit))
    await settle()

    expect(tr.style.height).toBe('74px')
  })
})

/**
 * The two props are meant to be interchangeable in every way a consumer can
 * touch them: same import, same shape, same opt-in, same runtime override.
 * Asserted rather than assumed, because they were built at different times and
 * `rowResize` reads through the controller while `columnResize` reads in the
 * view - two paths that could easily drift apart.
 */
describe('rowResize / columnResize symmetry', () => {
  it('are exported from the package the same way', async () => {
    const pkg = (await import('./index')) as Record<string, unknown>
    expect(typeof pkg.rowResize).toBe('function')
    expect(typeof pkg.columnResize).toBe('function')
  })

  it('both default to off', async () => {
    const target = mountGrid()
    await settle()
    await settle()
    expect(handles(target)).toBe(0)
    expect(strips(target)).toBe(0)
  })

  it('both turn on with an explicit true', async () => {
    const target = mountGrid({ columnResize: true, rowResize: true })
    await settle()
    await settle()
    expect(handles(target)).toBe(cols.length)
    expect(strips(target)).toBe(rows.length)
  })

  it('both turn on at runtime through api.setOption', async () => {
    // `columnResize` is read in the view and `rowResize` in the controller, but
    // both go through the same override proxy - so both must react here.
    let api: { setOption: (k: string, v: unknown) => void } | null = null
    const target = mountGrid({ onApiReady: (next: unknown) => (api = next as never) })
    await settle()
    expect(handles(target)).toBe(0)
    expect(strips(target)).toBe(0)

    api!.setOption('columnResize', true)
    api!.setOption('rowResize', true)
    await settle()
    await settle()
    expect(handles(target)).toBe(cols.length)
    expect(strips(target)).toBe(rows.length)
  })

  it('both turn back off through api.setOption', async () => {
    let api: { setOption: (k: string, v: unknown) => void } | null = null
    const target = mountGrid({
      columnResize: true,
      rowResize: true,
      onApiReady: (next: unknown) => (api = next as never),
    })
    await settle()
    await settle()
    expect(handles(target)).toBe(cols.length)
    expect(strips(target)).toBe(rows.length)

    api!.setOption('columnResize', false)
    api!.setOption('rowResize', false)
    await settle()
    await settle()
    expect(handles(target)).toBe(0)
    expect(strips(target)).toBe(0)
  })
})

describe('ColumnDef.resizable', () => {
  const mixed = [
    { field: 'name', header: 'Name', width: 200 },
    { field: 'team', header: 'Team', width: 140, resizable: false },
  ] as ColumnDef<typeof features, Row>[]

  it('drops the handle for the column that opted out', async () => {
    const target = mountGrid({ columnResize: true, columns: mixed })
    await settle()
    await settle()
    expect(handles(target)).toBe(1)
    const th = target
      .querySelector<HTMLElement>('.sv-grid-resize-handle')!
      .closest<HTMLElement>('th')!
    expect(th.dataset.svgridHeaderCol).toBe('name')
  })

  it('narrows columnResize rather than enabling anything', async () => {
    // With the grid-wide prop off, `resizable: true` must not bring a handle
    // back - the column option only ever subtracts.
    const target = mountGrid({
      columns: [
        { field: 'name', header: 'Name', width: 200, resizable: true },
        { field: 'team', header: 'Team', width: 140 },
      ] as ColumnDef<typeof features, Row>[],
    })
    await settle()
    await settle()
    expect(handles(target)).toBe(0)
  })

  it('leaves every column resizable when none opts out', async () => {
    const target = mountGrid({ columnResize: true })
    await settle()
    await settle()
    expect(handles(target)).toBe(cols.length)
  })
})

describe('rowResize brings in the row header column', () => {
  const gutters = (t: HTMLElement) => t.querySelectorAll('.sv-grid-row-number-cell').length

  it('shows the row-number gutter when rowResize is on', async () => {
    // The strip lives in the row header, which is where a spreadsheet puts it.
    // Without a gutter there is nothing that reads as a grab target.
    const target = mountGrid({ rowResize: true })
    await settle()
    await settle()
    expect(gutters(target)).toBe(rows.length)
    const strip = target.querySelector<HTMLElement>('.sv-grid-row-resize-handle')!
    expect(strip.closest('.sv-grid-row-number-cell')).not.toBeNull()
  })

  it('shows no gutter when rowResize is off', async () => {
    const target = mountGrid()
    await settle()
    await settle()
    expect(gutters(target)).toBe(0)
  })

  it('lets an explicit showRowNumbers={false} win', async () => {
    // Turning the gutter on is a default, not a takeover. The strip falls back
    // to the row's first cell so the prop still does something.
    const target = mountGrid({ rowResize: true, showRowNumbers: false })
    await settle()
    await settle()
    expect(gutters(target)).toBe(0)
    expect(strips(target)).toBe(rows.length)
    const strip = target.querySelector<HTMLElement>('.sv-grid-row-resize-handle')!
    expect(strip.closest('td')).not.toBeNull()
  })

  it('does not disturb a grid that already asked for the gutter', async () => {
    const target = mountGrid({ rowResize: true, showRowNumbers: true })
    await settle()
    await settle()
    expect(gutters(target)).toBe(rows.length)
  })

  it('brings no gutter when autoRowHeight has suppressed rowResize', async () => {
    // rowResizeOn is false there, so the gutter would be a column with no
    // purpose - the gate has to follow the resolved state, not the raw prop.
    const target = mountGrid({ rowResize: true, autoRowHeight: true })
    await settle()
    await settle()
    expect(gutters(target)).toBe(0)
    expect(strips(target)).toBe(0)
  })
})
