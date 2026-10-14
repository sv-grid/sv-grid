/**
 * The select fields' editor: filtering, picking with the keyboard, a new
 * option typed into the cell, and what each way out of a multiple select
 * keeps.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import SelectEditor from './SelectEditor.svelte'
import { setFieldUsers } from './sources.svelte'

enableFields()

const STATUS = [{ value: 'Todo', color: '#64748b' }, { value: 'Done', color: '#16a34a' }]
let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

function open(fieldType: 'singleSelect' | 'multiSelect', value: unknown, typed?: { row: Record<string, unknown> }) {
  const declared = { field: 'status', header: 'Status', fieldType, fieldProps: { options: STATUS } }
  const changes: any[] = []
  const grid = {
    props: { onColumnChange: (e: unknown) => changes.push(e) },
    internalColumns: [declared] as Record<string, unknown>[],
    internalData: [],
  }
  const calls = { commit: [] as unknown[], change: [] as unknown[], cancel: 0 }
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SelectEditor, {
    target,
    props: {
      value,
      typed: !!typed,
      row: typed?.row,
      columnDef: fillFieldColumn(declared),
      columnId: 'status',
      grid,
      onChange: (v: unknown) => calls.change.push(v),
      onCommit: (v?: unknown) => calls.commit.push(v),
      onCancel: () => (calls.cancel += 1),
    },
  })
  flushSync()
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  const input = document.querySelector<HTMLInputElement>('.sv-fse-search')!
  const key = (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    flushSync()
  }
  const type = (text: string) => {
    input.value = text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
  }
  const options = () => [...document.querySelectorAll('.sv-fse-option')].map((o) => o.textContent!.replace(/\s+/g, ' ').trim())
  return { calls, changes, grid, key, type, options }
}

describe('select editor', () => {
  it('lists the options as pills, filters them, and commits a single pick', () => {
    const ed = open('singleSelect', 'Todo')
    expect(ed.options()).toEqual(['Todo', 'Done'])
    // Matches, and the text itself as a new option: it is not one exactly.
    ed.type('do')
    expect(ed.options()).toEqual(['Todo', 'Done', 'Add option do'])
    // An exact match, in any case, is not offered again.
    ed.type('DONE')
    expect(ed.options()).toEqual(['Done'])
    ed.key('Enter')
    expect(ed.calls.commit).toEqual(['Done'])
  })

  it('a typed value that is not an option is added to the field and picked', () => {
    const ed = open('singleSelect', 'Todo')
    ed.type('Review')
    expect(ed.options()).toEqual(['Add option Review'])
    ed.key('Enter')
    expect(ed.calls.commit).toEqual(['Review'])
    // The field gets the option, with a color, after the value is committed.
    const options = ed.changes[0].columns[0].fieldProps.options
    expect(options.map((o: { value: string }) => o.value)).toEqual(['Todo', 'Done', 'Review'])
    expect(options[2].color).toMatch(/^#/)
  })

  it('a letter typed on the cell searches the options; the choices made stay', () => {
    const ed = open('multiSelect', 'd', { row: { status: ['Todo'] } })
    expect((document.querySelector('.sv-fse-search') as HTMLInputElement).value).toBe('d')
    expect(ed.options()).toEqual(['Done', 'Add option d'])
    ed.key('Enter')
    expect(ed.calls.change.at(-1)).toEqual(['Todo', 'Done'])
  })

  it('Escape leaves a single select as it was', () => {
    const ed = open('singleSelect', 'Todo')
    ed.key('ArrowDown')
    ed.key('Escape')
    expect(ed.calls.cancel).toBe(1)
    expect(ed.calls.commit).toEqual([])
  })

  it('a multiple select stays open to pick more; Backspace removes the last; Escape keeps them', () => {
    const ed = open('multiSelect', ['Todo'])
    // Chosen options leave the list.
    expect(ed.options()).toEqual(['Done'])
    ed.key('Enter')
    expect(ed.calls.change.at(-1)).toEqual(['Todo', 'Done'])
    expect(ed.calls.commit).toEqual([])
    ed.key('Backspace')
    expect(ed.calls.change.at(-1)).toEqual(['Todo'])
    ed.key('Escape')
    expect(ed.calls.commit).toEqual([['Todo']])
    expect(ed.calls.cancel).toBe(0)
  })
})

describe('user field', () => {
  const PEOPLE = [
    { id: 'u1', name: 'Ana Ruiz', email: 'ana@example.com' },
    { id: 'u2', name: 'Ben Okafor' },
  ]

  function openUser(value: unknown, multiple = false) {
    setFieldUsers(PEOPLE)
    const declared = { field: 'owner', header: 'Owner', fieldType: 'user', fieldProps: { multiple } }
    const calls = { commit: [] as unknown[], change: [] as unknown[] }
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SelectEditor, {
      target,
      props: {
        value,
        columnDef: fillFieldColumn(declared),
        columnId: 'owner',
        onChange: (v: unknown) => calls.change.push(v),
        onCommit: (v?: unknown) => calls.commit.push(v),
        onCancel: () => {},
      },
    })
    flushSync()
    cleanup = () => {
      unmount(app)
      target.remove()
      setFieldUsers([])
    }
    return { calls, target }
  }

  it('lists the people with their avatars, as the cells draw them, and offers no new option', () => {
    const { calls } = openUser('u2')
    const rows = [...document.querySelectorAll('.sv-fse-option')]
    expect(rows.map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['AR Ana Ruiz', 'BO Ben Okafor'])
    expect(rows.every((r) => r.querySelector('.sv-fuf'))).toBe(true)
    const input = document.querySelector<HTMLInputElement>('.sv-fse-search')!
    expect(input.placeholder).toBe('Find a person')
    input.value = 'zed'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(document.querySelector('.sv-fse-add')).toBeNull()
    input.value = 'ana'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(calls.commit).toEqual(['u1'])
  })

  it('a paste is read as names or emails', () => {
    setFieldUsers(PEOPLE)
    const many = fillFieldColumn({ field: 'o', fieldType: 'user', fieldProps: { multiple: true } })
    const parse = many.valueParser as (x: Record<string, unknown>) => unknown
    expect(parse({ newValue: null, rawInput: 'ben okafor, ana@example.com' })).toEqual(['u2', 'u1'])
    setFieldUsers([])
  })
})
