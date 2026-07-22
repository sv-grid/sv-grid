/**
 * DOM test: SvRecordDetail renders a record header (title + status pill + metric
 * tiles), a tabbed Overview of field groups, and a related-collection timeline
 * filtered by the foreign key. Also mounts against the real CRM deals + activities
 * sample so the detail <-> sample path is covered.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvRecordDetail from './SvRecordDetail.svelte'
import { getSampleApp } from './studio/samples/index'
import type { EntitySchema } from './schema'

const dealsSchema: EntitySchema = {
  name: 'deals',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text' },
    { field: 'owner', type: 'text', label: 'Owner' },
    { field: 'value', type: 'number', label: 'Value ($)' },
    { field: 'probability', type: 'number', label: 'Probability (%)' },
    { field: 'stage', type: 'enum', options: [
      { value: 'lead', label: 'Lead', color: '#94a3b8' },
      { value: 'won', label: 'Won', color: '#10b981' },
    ] },
  ],
}
const actsSchema: EntitySchema = {
  name: 'activities',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'subject', type: 'text' },
    { field: 'dealId', type: 'relation', relation: { entity: 'deals', foreignKey: 'dealId', labelField: 'title' } },
    { field: 'dueDate', type: 'date' },
  ],
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvRecordDetail, { target: host, props })
  flushSync()
  return host
}

describe('SvRecordDetail (DOM)', () => {
  it('renders header title, status pill, and metric tiles', () => {
    const rows = [{ id: 'd1', title: 'Alpha deal', owner: 'Sam', value: 1000, probability: 60, stage: 'won' }]
    const el = render({ schema: dealsSchema, rows, titleField: 'title', subtitleField: 'owner', statusField: 'stage', metricFields: ['value', 'probability'] })
    expect(el.querySelector('.sv-detail__title')?.textContent).toBe('Alpha deal')
    expect(el.querySelector('.sv-detail__status')?.textContent).toBe('Won')
    const metrics = [...el.querySelectorAll('.sv-detail__metric-value')].map((n) => n.textContent)
    expect(metrics).toContain('$1,000') // money-formatted from the "Value ($)" label
    expect(metrics).toContain('60')
  })

  it('auto-builds an Overview of the remaining fields when no sections given', () => {
    const rows = [{ id: 'd1', title: 'Alpha', owner: 'Sam', value: 1000, probability: 60, stage: 'won' }]
    const el = render({ schema: dealsSchema, rows, titleField: 'title', statusField: 'stage', metricFields: ['value'] })
    const labels = [...el.querySelectorAll('.sv-detail__field dt')].map((n) => n.textContent)
    // title/stage/value are surfaced in the header, so the auto group shows the rest.
    expect(labels).toContain('Owner')
    expect(labels).toContain('Probability (%)')
    expect(labels).not.toContain('Value ($)') // in the header metrics, not the Overview
  })

  it('shows a related timeline filtered by the foreign key', () => {
    const rows = [{ id: 'd1', title: 'Alpha', stage: 'won' }, { id: 'd2', title: 'Beta', stage: 'lead' }]
    const acts = [
      { id: 'a1', subject: 'Call', dealId: 'd1', dueDate: '2026-03-01' },
      { id: 'a2', subject: 'Email', dealId: 'd1', dueDate: '2026-03-05' },
      { id: 'a3', subject: 'Other', dealId: 'd2', dueDate: '2026-03-02' },
    ]
    const el = render({
      schema: dealsSchema, rows, titleField: 'title', statusField: 'stage',
      related: [{ label: 'Activities', schema: actsSchema, rows: acts, foreignKey: 'dealId', titleField: 'subject', dateField: 'dueDate' }],
    })
    // Two tabs: Overview + Activities.
    const tabs = [...el.querySelectorAll('.sv-detail__tab')].map((n) => n.textContent)
    expect(tabs).toEqual(['Overview', 'Activities'])
    // Switch to the Activities tab.
    const actTab = [...el.querySelectorAll<HTMLButtonElement>('.sv-detail__tab')].find((b) => b.textContent === 'Activities')!
    actTab.click()
    flushSync()
    const events = [...el.querySelectorAll('.sv-detail__event-title')].map((n) => n.textContent)
    expect(events).toEqual(['Email', 'Call']) // only d1's activities, newest date first
  })

  it('mounts against the real CRM deals + activities sample', () => {
    const proj = getSampleApp('crm')!.build()
    const deals = proj.entities.find((e) => e.name === 'deals')
    const activities = proj.entities.find((e) => e.name === 'activities')
    const dealRows = (proj.dataSources!.deals as { seed?: Record<string, unknown>[] }).seed!
    const actRows = (proj.dataSources!.activities as { seed?: Record<string, unknown>[] }).seed!
    const el = render({
      schema: deals, rows: dealRows, titleField: 'title', subtitleField: 'companyId', statusField: 'stage', metricFields: ['value', 'probability'],
      related: [{ label: 'Activities', schema: activities, rows: actRows, foreignKey: 'dealId', titleField: 'subject', dateField: 'dueDate', statusField: 'priority' }],
    })
    expect(el.querySelector('.sv-detail__title')?.textContent).toBeTruthy()
    expect(el.querySelectorAll('.sv-detail__metric').length).toBe(2)
    expect([...el.querySelectorAll('.sv-detail__tab')].map((n) => n.textContent)).toEqual(['Overview', 'Activities'])
  })

  it('matches a related timeline by parentField when the child has no FK id (denormalized view)', () => {
    const productsSchema: EntitySchema = {
      name: 'products', idField: 'id',
      fields: [{ field: 'id', type: 'number', primaryKey: true }, { field: 'name', type: 'text' }],
    }
    const linesSchema: EntitySchema = {
      name: 'order_lines', idField: 'id',
      fields: [{ field: 'id', type: 'number', primaryKey: true }, { field: 'product', type: 'text' }, { field: 'customer', type: 'text' }, { field: 'line_total', type: 'number', label: 'Total ($)' }],
    }
    const rows = [{ id: 1, name: 'Chai' }, { id: 2, name: 'Chang' }]
    // The view carries the product NAME (not its id), so the timeline matches name.
    const lines = [
      { id: 10, product: 'Chai', customer: 'Alfreds', line_total: 90 },
      { id: 11, product: 'Chang', customer: 'Berglunds', line_total: 40 },
      { id: 12, product: 'Chai', customer: "B's", line_total: 54 },
    ]
    const el = render({
      schema: productsSchema, rows, titleField: 'name',
      related: [{ label: 'Orders', schema: linesSchema, rows: lines, foreignKey: 'product', parentField: 'name', titleField: 'customer', subtitleField: 'line_total' }],
    })
    const ordersTab = [...el.querySelectorAll<HTMLButtonElement>('.sv-detail__tab')].find((b) => b.textContent === 'Orders')!
    ordersTab.click()
    flushSync()
    // Opens on Chai -> its two lines (matched by name, not id), $ money-formatted.
    const events = [...el.querySelectorAll('.sv-detail__event-title')].map((n) => n.textContent)
    expect(events.sort()).toEqual(['Alfreds', "B's"])
    expect(el.textContent).toContain('$90')
  })
})
