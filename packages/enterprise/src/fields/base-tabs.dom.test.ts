/**
 * `<SvBase tables>`: the tables as tabs, and a link between two of them kept
 * in step from the grid's own edits.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, SvBase, type BaseTable } from './index'
import { gridOf, writeCell } from './grid-access'
import { getLinkedTable, rowsOf } from './sources.svelte'
import DeleteFieldConfirm from './DeleteFieldConfirm.svelte'
import BaseTabs from './BaseTabs.svelte'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r, 5))
// By time, not by turns: a cold run compiles the grid as a tab first mounts it.
async function until(check: () => boolean, label: string) {
  const end = Date.now() + 5000
  while (Date.now() < end) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

const make = (): BaseTable[] => [
  {
    id: 't-deals',
    name: 'Deals',
    primaryField: 'deal',
    columns: [
      { id: 'deal', field: 'deal', header: 'Deal', fieldType: 'text' },
      { id: 'account', field: 'account', header: 'Account', fieldType: 'link', fieldProps: { table: 't-accounts', multiple: false, inverse: 'deals' } },
    ],
    data: [
      { id: 'd1', deal: 'Renewal', account: ['a1'] },
      { id: 'd2', deal: 'Pilot', account: [] },
    ],
  },
  {
    id: 't-accounts',
    name: 'Accounts',
    primaryField: 'name',
    columns: [
      { id: 'name', field: 'name', header: 'Name', fieldType: 'text' },
      { id: 'deals', field: 'deals', header: 'Deals', fieldType: 'link', fieldProps: { table: 't-deals', multiple: true, inverse: 'account' } },
    ],
    data: [
      { id: 'a1', name: 'Contoso', deals: ['d1'] },
      { id: 'a2', name: 'Fabrikam', deals: [] },
    ],
  },
]

const mounted: Array<() => void> = []
afterEach(() => {
  while (mounted.length) mounted.pop()!()
})

function mountBase(tables: BaseTable[] = make()) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const state: { api: any; tables: BaseTable[] } = { api: null, tables }
  const app = mount(SvBase as any, {
    target,
    props: {
      tables: state.tables,
      onTablesChange: (t: BaseTable[]) => (state.tables = t),
      editable: true,
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: unknown) => (state.api = a),
    },
  })
  flushSync()
  mounted.push(() => {
    unmount(app)
    target.remove()
    document.querySelectorAll('.sv-pop__panel, .sv-modal').forEach((n) => n.remove())
  })
  const tabs = () => [...target.querySelectorAll('.sv-btabs [role="tab"]')].map((t) => t.textContent?.trim())
  const accounts = () => state.tables.find((t) => t.id === 't-accounts')!
  return { target, state, tabs, accounts }
}

describe('SvBase with tables', () => {
  it('shows the tables as tabs and keeps a link and its field back in step', async () => {
    const b = mountBase()
    await until(() => !!b.state.api && !!gridOf(b.state.api), 'the deals grid')
    expect(b.tabs()).toEqual(['Deals', 'Accounts'])
    expect(b.target.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Deals')

    // Pilot links to Contoso: Contoso lists it.
    expect(writeCell(gridOf(b.state.api), 'd2', 'account', ['a1'])).toBe(true)
    await until(() => (b.accounts().data[0]!.deals as string[]).length === 2, 'the field back')
    expect(b.accounts().data[0]!.deals).toEqual(['d1', 'd2'])

    // On the Accounts tab, Fabrikam takes Renewal: the deal's account changes.
    const first = b.state.api
    ;([...b.target.querySelectorAll('.sv-btabs [role="tab"]')].find((t) => t.textContent?.includes('Accounts')) as HTMLElement).click()
    flushSync()
    await until(() => !!b.state.api && b.state.api !== first && !!gridOf(b.state.api), 'the accounts grid')
    expect(b.target.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Accounts')
    // Contoso still lists Renewal: a deal has one account, so Contoso lets go of it.
    expect(writeCell(gridOf(b.state.api), 'a2', 'deals', ['d1'])).toBe(true)
    await until(() => (b.state.tables[0]!.data[0]!.account as string[])[0] === 'a2', 'the deal moved')
    expect(b.state.tables[0]!.data.map((r) => r.account)).toEqual([['a2'], ['a1']])
    expect(b.accounts().data.map((r) => r.deals)).toEqual([['d2'], ['d1']])
    // The shown grid has the new value too.
    expect((gridOf(b.state.api).internalData as Array<Record<string, unknown>>).map((r) => r.deals)).toEqual([['d2'], ['d1']])
  })

  it('deleting a link field deletes its field back and the fields on both sides that read them', async () => {
    const tables = make()
    tables[0]!.columns.push({ id: 'acc', field: 'acc', header: 'Account name', fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'name' } })
    tables[1]!.columns.push({ id: 'n', field: 'n', header: 'Deal count', fieldType: 'count', fieldProps: { linkField: 'deals' } })
    const b = mountBase(tables)
    await until(() => !!b.state.api && !!gridOf(b.state.api), 'the deals grid')
    const ctrl = gridOf(b.state.api)
    const target = document.createElement('div')
    document.body.appendChild(target)
    const dialog = mount(DeleteFieldConfirm as any, { target, props: { ctrl, columnId: 'account', onClose: () => {} } })
    mounted.push(() => {
      unmount(dialog)
      target.remove()
    })
    flushSync()
    await until(() => !!document.querySelector('.sv-fdel-note'), 'the dialog')
    expect(document.querySelector('.sv-fdel-note')?.textContent).toBe('These fields read it and are deleted too: Account name, Deal count (Accounts).')
    ;([...document.querySelectorAll('.sv-fdel-btn')].find((x) => x.textContent === 'Delete field') as HTMLElement).click()
    await until(() => b.accounts().columns.length === 1, 'the field back gone')
    expect(b.state.tables[0]!.columns.map((d) => d.id)).toEqual(['deal'])
    expect(b.accounts().columns.map((d) => d.id)).toEqual(['name'])
    await until(() => (ctrl.internalColumns as unknown[]).length === 1, 'the grid without them')
  })

  it('a second base with the same table ids, unmounted, leaves the first one its tables', async () => {
    const first = mountBase()
    await until(() => !!first.state.api, 'the first grid')
    const other = make()
    other[1]!.data = [{ id: 'a9', name: 'Only here', deals: [] }]
    const second = mountBase(other)
    await until(() => !!second.state.api, 'the second grid')
    // The newest registration is shown: the second base's.
    expect(rowsOf(getLinkedTable('t-accounts')!).map((r) => r.name)).toEqual(['Only here'])
    mounted.pop()!()
    const table = getLinkedTable('t-accounts')
    expect(table).toBeDefined()
    expect(rowsOf(table!).map((r) => r.name)).toEqual(['Contoso', 'Fabrikam'])
  })

  it('adds a table from the tab bar and shows it', async () => {
    const b = mountBase()
    await until(() => !!b.state.api, 'the grid')
    ;(b.target.querySelector('.sv-btabs-add') as HTMLElement).click()
    flushSync()
    await until(() => b.tabs().length === 3, 'a third tab')
    expect(b.tabs()).toEqual(['Deals', 'Accounts', 'Table'])
    expect(b.state.tables[2]).toMatchObject({ name: 'Table', primaryField: 'name' })
    await until(() => b.target.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Table', 'the new tab shown')
  })
})

describe('BaseTabs', () => {
  it('lists the link fields and the fields reading them that go with a deleted table', async () => {
    const tables = make()
    tables[0]!.columns.push({ id: 'acc', field: 'acc', header: 'Account name', fieldType: 'lookup', fieldProps: { linkField: 'account', field: 'name' } })
    const target = document.createElement('div')
    document.body.appendChild(target)
    const deleted: string[] = []
    const app = mount(BaseTabs as any, {
      target,
      props: { tables, activeId: 't-accounts', onSwitch: () => {}, onAdd: () => {}, onRename: () => {}, onDuplicate: () => {}, onDelete: (id: string) => deleted.push(id) },
    })
    mounted.push(() => {
      unmount(app)
      target.remove()
      document.querySelectorAll('.sv-pop__panel, .sv-modal').forEach((n) => n.remove())
    })
    flushSync()
    ;(target.querySelector('.sv-btabs-more') as HTMLElement).click()
    flushSync()
    await until(() => [...document.querySelectorAll('.sv-btabs-item')].some((x) => x.textContent === 'Delete table'), 'the menu')
    ;([...document.querySelectorAll('.sv-btabs-item')].find((x) => x.textContent === 'Delete table') as HTMLElement).click()
    flushSync()
    await until(() => !!document.querySelector('.sv-btabs-links'), 'the dialog')
    expect([...document.querySelectorAll('.sv-btabs-links li')].map((li) => li.textContent)).toEqual(['Deals: Account', 'Deals: Account name (reads Account)'])
  })
})
