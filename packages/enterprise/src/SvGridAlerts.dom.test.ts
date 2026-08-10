/**
 * DOM tests for the alerts overlay + editors. Covers (1) the observe -> fire
 * loop through `attachAlertEngine` (which needs the browser build for the toast
 * store), and (2) that the Svelte surfaces mount and render without error.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGridAlerts from './SvGridAlerts.svelte'
import SvExpressionEditor from './SvExpressionEditor.svelte'
import SvAlertsManager from './SvAlertsManager.svelte'
import { attachAlertEngine } from './alerts/alert-engine-attach'
import { alertStore } from './alerts/alert-store.svelte'
import { createAlertRules, memoryAlertRules } from './alerts/alert-storage'
import type { AlertRule } from './alerts/alert-types'
import type { ExprColumn } from './expressions/expression-columns'

type Row = { id: string; price: number; region: string }

const columns: ExprColumn[] = [
  { id: 'price', name: 'Price', type: 'number' },
  { id: 'region', name: 'Region', type: 'text' },
]

const highPrice: AlertRule = {
  id: 'r1',
  name: 'High price',
  enabled: true,
  severity: 'warning',
  scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast', message: '{region} at {value}' }, { kind: 'highlight', style: { background: '#fee2e2' } }],
  createdAt: 0,
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
  alertStore.clear()
})

function render(Component: unknown, props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(Component as never, { target: host, props })
  flushSync()
  return host
}

describe('attachAlertEngine observe -> fire loop', () => {
  it('seeds silently, then fires when a row newly matches', () => {
    const rows: Row[] = [
      { id: 'a', price: 80, region: 'EU' },
      { id: 'b', price: 90, region: 'US' },
    ]
    const attach = attachAlertEngine<Row>({
      rules: [highPrice],
      getRowId: (r) => r.id,
      getData: () => rows,
      intervalMs: 0, // drive manually
    })

    attach.tick() // initial seed - nothing above 100 yet
    expect(alertStore.events).toHaveLength(0)

    rows[0] = { ...rows[0]!, price: 130 } // 'a' crosses the threshold
    attach.tick()
    expect(alertStore.events.length).toBe(1)
    expect(alertStore.events[0]!.message).toBe('EU at 130')

    // Staying above the line must not re-fire.
    attach.tick()
    expect(alertStore.events.length).toBe(1)
    attach.detach()
  })
})

describe('SvGridAlerts (DOM)', () => {
  it('renders the alerts controls', () => {
    const el = render(SvGridAlerts, {
      data: [{ id: 'a', price: 120, region: 'EU' }],
      columns,
      rules: [highPrice],
    })
    expect(el.querySelector('.sg-alerts-bell')).toBeTruthy()
    expect(el.textContent).toContain('Manage alerts')
  })
})

describe('SvExpressionEditor (DOM)', () => {
  it('renders builder + text mode tabs', () => {
    const el = render(SvExpressionEditor, {
      columns,
      value: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
      rows: [{ price: 120 }, { price: 50 }],
    })
    expect(el.textContent).toContain('Builder')
    expect(el.textContent).toContain('Text')
    // Live preview counts matches over the sample rows.
    expect(el.textContent).toContain('Matches 1 of 2')
  })
})

describe('SvAlertsManager (DOM)', () => {
  it('lists persisted rules when open', () => {
    const manager = createAlertRules(memoryAlertRules([highPrice]))
    render(SvAlertsManager, { open: true, manager, columns })
    // The manager renders inside a portalled modal.
    expect(document.body.textContent).toContain('High price')
  })
})
