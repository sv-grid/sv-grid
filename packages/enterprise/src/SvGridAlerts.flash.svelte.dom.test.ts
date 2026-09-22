/**
 * DOM test with runes: a cellFlash comes and goes, and a scheduled rule
 * fires on its cron.
 *
 * The flash list was deep `$state` and a flash was removed by identity 900 ms
 * after it was added; a deep proxy never equals the object that was pushed,
 * so no flash was ever removed and Svelte warned on every tick. A `scheduled`
 * trigger was accepted by the rule editor and never run by anything.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGridAlerts from './SvGridAlerts.svelte'
import { alertStore } from './alerts/alert-store.svelte'
import type { AlertRule } from './alerts/alert-types'
import type { ExprColumn } from './expressions/expression-columns'
import type { ConditionalFormat } from '@svgrid/grid/format'

type Row = { id: string; price: number; region: string }
const columns: ExprColumn[] = [
  { id: 'price', name: 'Price', type: 'number' },
  { id: 'region', name: 'Region', type: 'text' },
]
const base: AlertRule = {
  id: 'r1', name: 'High price', enabled: true, severity: 'warning', scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast', message: '{region} at {value}' }],
  createdAt: 0,
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
  alertStore.clear()
  vi.useRealTimers()
})

type Handle = { pushChanged: (rows: readonly Row[]) => void; flush: () => void }

describe('SvGridAlerts flashes', () => {
  it('a cellFlash is in the bound formats after the firing and gone 900 ms later', async () => {
    vi.useFakeTimers()
    let handle: Handle | null = null
    const props = $state({
      data: [{ id: 'a', price: 80, region: 'EU' }] as Row[],
      columns,
      rules: [{ ...base, id: 'flash', scope: 'cell' as const, columns: ['price'], actions: [{ kind: 'cellFlash' as const }] }],
      watch: false,
      formats: [] as ConditionalFormat<Row>[],
      onReady: (h: Handle) => (handle = h),
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvGridAlerts, { target: host, props })
    flushSync()

    handle!.pushChanged([{ id: 'a', price: 150, region: 'EU' }])
    handle!.flush()
    flushSync()
    const isFlash = (f: ConditionalFormat<Row>) => f.type === 'rule' && String((f as { background?: string }).background).includes('cell-flash')
    expect(props.formats.some(isFlash)).toBe(true)

    vi.advanceTimersByTime(1000)
    flushSync()
    expect(props.formats.some(isFlash)).toBe(false)
  })
})

describe('SvGridAlerts scheduled rules', () => {
  it('a scheduled rule fires on its cron with every row matching then', () => {
    // The scheduler ticks every 30 s and fires once per due minute; a cron of
    // every minute is due on the first tick.
    vi.useFakeTimers()
    const props = $state({
      data: [{ id: 'a', price: 800, region: 'EU' }, { id: 'b', price: 50, region: 'US' }, { id: 'c', price: 900, region: 'EU' }] as Row[],
      columns,
      rules: [{ ...base, id: 'sched', trigger: { type: 'scheduled' as const, schedule: { id: 'sched', name: 'Every minute', cron: '* * * * *' } } }],
      watch: false,
      formats: [] as ConditionalFormat<Row>[],
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvGridAlerts, { target: host, props })
    flushSync()
    expect(alertStore.events.filter((e) => e.ruleId === 'sched').length).toBe(0)

    vi.advanceTimersByTime(31_000)
    flushSync()
    const fired = alertStore.events.filter((e) => e.ruleId === 'sched')
    expect(fired.map((e) => e.rowId).sort()).toEqual(['a', 'c'])
    expect(fired[0]!.triggerType).toBe('scheduled')
  })
})

describe('SvGridAlerts props after mount', () => {
  it('a getRowId or getValue set after mount is what the next evaluation uses', () => {
    // Both used to be copied once at mount, so the engine kept answering with
    // the first getRowId and the first getValue for the life of the overlay.
    type Coded = Row & { code: string; alt: number }
    let handle: Handle | null = null
    const props = $state({
      data: [{ id: 'a', code: 'A-1', price: 80, alt: 500, region: 'EU' }] as Coded[],
      columns,
      rules: [{ ...base, id: 'live' }],
      watch: false,
      formats: [] as ConditionalFormat<Coded>[],
      getRowId: (r: Coded) => r.id,
      getValue: (r: Coded, col: string) => (r as unknown as Record<string, unknown>)[col],
      onReady: (h: Handle) => (handle = h),
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvGridAlerts, { target: host, props })
    flushSync()

    // Switch the identity to the code and the price to the alt column.
    props.getRowId = (r: Coded) => r.code
    props.getValue = (r: Coded, col: string) => (col === 'price' ? r.alt : (r as unknown as Record<string, unknown>)[col])
    flushSync()
    // price 80 would not fire; alt 500 does, and the event is keyed by code.
    handle!.pushChanged([{ id: 'a', code: 'A-1', price: 80, alt: 500, region: 'EU' }] as unknown as Row[])
    handle!.flush()
    flushSync()
    const fired = alertStore.events.filter((e) => e.ruleId === 'live')
    expect(fired.map((e) => e.rowId)).toEqual(['A-1'])
  })
})

describe('SvGridAlerts highlights', () => {
  it('a highlight rule is in the bound formats at mount and matches the seeded row', () => {
    const props = $state({
      data: [{ id: 'a', price: 800, region: 'EU' }, { id: 'b', price: 50, region: 'US' }] as Row[],
      columns,
      rules: [{ ...base, actions: [{ kind: 'highlight' as const, style: { background: '#fef3c7' } }] }],
      formats: [] as ConditionalFormat<Row>[],
    })
    host = document.createElement('div')
    document.body.appendChild(host)
    comp = mount(SvGridAlerts, { target: host, props })
    flushSync()
    const rule = props.formats.find((f) => f.type === 'rule' && (f as { background?: string }).background === '#fef3c7') as { when: (p: { value: unknown; row: Row }) => boolean } | undefined
    expect(rule).toBeTruthy()
    expect(rule!.when({ value: 800, row: props.data[0]! })).toBe(true)
    expect(rule!.when({ value: 50, row: props.data[1]! })).toBe(false)
  })
})
