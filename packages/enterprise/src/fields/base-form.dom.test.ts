/**
 * The form that adds a record (SvBaseForm, and a base's form view): each
 * form view starts its own draft, an async onSubmit is waited on, a select
 * never adds options, the view's required fields and submit label, format
 * and `validate` checks, defaults shown in the fields, and an id on a
 * record a form adds to a base table without a row adder.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, SvBase, SvBaseForm, type BaseTable, type FieldView } from './index'
import { gridOf } from './grid-access'

enableFields()

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const settle = () => new Promise<void>((r) => setTimeout(r))
async function until(check: () => boolean, label: string) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await settle()
  }
  throw new Error(`timed out waiting for ${label}`)
}

const STATUS = [{ value: 'Todo' }, { value: 'Done' }]
const COLUMNS = [
  { field: 'task', header: 'Task', fieldType: 'text' },
  { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: STATUS, default: 'Todo' } },
  { field: 'email', header: 'Email', fieldType: 'email' },
  { field: 'site', header: 'Site', fieldType: 'url' },
  { field: 'note', header: 'Note', fieldType: 'text' },
  { field: 'code', header: 'Code', fieldType: 'text', validate: ({ value }: { value: unknown }) => (!value || /^[A-Z]{3}$/.test(String(value)) ? null : 'Three capital letters') },
]
const DATA = () => [{ id: 1, task: 'Registry', status: 'Done', email: '', site: '', note: '', code: 'ABC' }]

function mountBase(props: Record<string, unknown>) {
  const added: Record<string, unknown>[] = []
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvBase as any, {
    target,
    props: {
      data: DATA(),
      columns: COLUMNS,
      getRowId: (r: { id: unknown }) => String(r.id),
      primaryField: 'task',
      editable: true,
      containerHeight: 400,
      virtualization: false,
      columnVirtualization: false,
      onRowAdd: (e: { row: Record<string, unknown> }) => added.push(e.row),
      onApiReady: (a: unknown) => (api = a),
      ...props,
    },
  })
  flushSync()
  return {
    target,
    added,
    get api() {
      return api
    },
    destroy: () => {
      unmount(app)
      target.remove()
      document.querySelectorAll('.sv-pop__panel, .sv-modal, .sv-fse-panel').forEach((n) => n.remove())
    },
  }
}

const fieldOf = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('.sv-fform-field')].find((f) => f.querySelector('.sv-fform-label')?.textContent?.replace('*', '').trim() === label) as HTMLElement
const shown = (root: ParentNode, label: string) => fieldOf(root, label).querySelector('.sv-frv-box')?.textContent?.trim()
const errorOf = (root: ParentNode, label: string) => fieldOf(root, label).querySelector('.sv-fform-error')?.textContent?.trim() ?? ''

async function typeInto(root: ParentNode, label: string, text: string) {
  ;(fieldOf(root, label).querySelector('.sv-frv-box') as HTMLElement).click()
  flushSync()
  await until(() => !!fieldOf(root, label).querySelector('.sv-frv-input'), `the ${label} box`)
  const input = fieldOf(root, label).querySelector('.sv-frv-input') as HTMLInputElement
  input.value = text
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  flushSync()
}
function submit(root: ParentNode) {
  ;(root.querySelector('.sv-fform-submit') as HTMLElement).click()
  flushSync()
}

describe('SvBaseForm', () => {
  it('gives each form view its own draft and its own thank-you', async () => {
    const views: FieldView[] = [
      { id: 'a', name: 'Form A', type: 'form', formFields: ['task'] },
      { id: 'b', name: 'Form B', type: 'form', formFields: ['task'] },
    ]
    const t = mountBase({ views })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      await typeInto(t.target, 'Task', 'Typed in A')
      expect(shown(t.target, 'Task')).toBe('Typed in A')
      ;(t.target.querySelector('.sv-fvb-view') as HTMLElement).click()
      flushSync()
      await until(() => [...document.querySelectorAll('.sv-fviews-pick')].some((b) => b.textContent?.includes('Form B')), 'the views menu')
      ;([...document.querySelectorAll('.sv-fviews-pick')].find((b) => b.textContent?.includes('Form B')) as HTMLElement).click()
      flushSync()
      await until(() => shown(t.target, 'Task') !== 'Typed in A', 'a fresh form')
      expect(shown(t.target, 'Task')).toBe('Type here')
    } finally {
      t.destroy()
    }
  })

  it('takes the view\'s required fields and submit label', async () => {
    const views: FieldView[] = [{ id: 'f', name: 'Ask', type: 'form', formFields: ['task', 'note'], formRequired: ['note'], formSubmitLabel: 'Send request' }]
    const t = mountBase({ views })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      expect(t.target.querySelector('.sv-fform-submit')?.textContent?.trim()).toBe('Send request')
      expect(fieldOf(t.target, 'Note').querySelector('.sv-fform-req')).not.toBeNull()
      submit(t.target)
      expect(errorOf(t.target, 'Note')).toBe('Note is required')
      expect(t.added).toHaveLength(0)
      await typeInto(t.target, 'Note', 'Soon')
      expect(errorOf(t.target, 'Note')).toBe('')
      submit(t.target)
      await until(() => t.added.length === 1, 'the record')
      expect(t.added[0]).toMatchObject({ note: 'Soon' })
    } finally {
      t.destroy()
    }
  })

  it('checks email and URL formats and the column\'s validate, and blocks the submit', async () => {
    const views: FieldView[] = [{ id: 'f', name: 'Ask', type: 'form', formFields: ['task', 'email', 'site', 'code'] }]
    const t = mountBase({ views })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      await typeInto(t.target, 'Email', 'not-an-address')
      await typeInto(t.target, 'Site', 'nowhere')
      await typeInto(t.target, 'Code', 'abc')
      submit(t.target)
      expect(errorOf(t.target, 'Email')).toBe('Not a valid email address')
      expect(errorOf(t.target, 'Site')).toBe('Not a valid web address')
      expect(errorOf(t.target, 'Code')).toBe('Three capital letters')
      expect(t.added).toHaveLength(0)

      await typeInto(t.target, 'Email', 'ana@example.com')
      await typeInto(t.target, 'Site', 'svgrid.com/docs')
      await typeInto(t.target, 'Code', 'XYZ')
      submit(t.target)
      await until(() => t.added.length === 1, 'the record')
      expect(t.added[0]).toMatchObject({ email: 'ana@example.com', site: 'svgrid.com/docs', code: 'XYZ' })
    } finally {
      t.destroy()
    }
  })

  it('shows the defaults, sends a cleared default as empty and leaves an untouched field out', async () => {
    const views: FieldView[] = [{ id: 'f', name: 'Ask', type: 'form', formFields: ['task', 'status', 'note'] }]
    const t = mountBase({ views, rowAdder: { defaults: () => ({ note: 'From the adder' }) } })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      expect(shown(t.target, 'Status')).toBe('Todo')
      expect(shown(t.target, 'Note')).toBe('From the adder')
      await typeInto(t.target, 'Note', '')
      submit(t.target)
      await until(() => t.added.length === 1, 'the record')
      expect(t.added[0]!.status).toBe('Todo')
      expect(t.added[0]!.note).toBe('')
      expect('task' in t.added[0]!).toBe(false)
    } finally {
      t.destroy()
    }
  })

  it('runs the column\'s valueParser on what a field gets, as a cell edit does', async () => {
    const seen: Array<Record<string, unknown>> = []
    const columns = [
      ...COLUMNS,
      {
        field: 'sku', header: 'SKU', fieldType: 'text',
        valueParser: (p: Record<string, unknown>) => {
          seen.push(p)
          return String(p.newValue ?? '').trim().toUpperCase()
        },
      },
    ]
    const views: FieldView[] = [{ id: 'f', name: 'Ask', type: 'form', formFields: ['task', 'sku'] }]
    const t = mountBase({ views, columns })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      await typeInto(t.target, 'SKU', '  ab-12 ')
      expect(shown(t.target, 'SKU')).toBe('AB-12')
      expect(seen.at(-1)).toMatchObject({ newValue: '  ab-12 ', rawInput: '  ab-12 ', columnId: 'sku' })
      submit(t.target)
      await until(() => t.added.length === 1, 'the record')
      expect(t.added[0]).toMatchObject({ sku: 'AB-12' })
    } finally {
      t.destroy()
    }
  })

  it('offers only the field\'s options in a select, never "Add option"', async () => {
    const views: FieldView[] = [{ id: 'f', name: 'Ask', type: 'form', formFields: ['status'] }]
    const t = mountBase({ views })
    try {
      await until(() => !!t.target.querySelector('.sv-fform'), 'the form')
      ;(fieldOf(t.target, 'Status').querySelector('.sv-frv-box') as HTMLElement).click()
      flushSync()
      await until(() => !!document.querySelector('.sv-fse-search'), 'the select panel')
      const search = document.querySelector('.sv-fse-search') as HTMLInputElement
      search.value = 'Brand new'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      expect(document.querySelector('.sv-fse-add')).toBeNull()
      expect(document.querySelector('.sv-fse-empty')?.textContent?.trim()).toBe('No option matches')
    } finally {
      t.destroy()
    }
  })

  it('waits on a Promise from onSubmit: busy, then the error and the draft, then thanks', async () => {
    const t = mountBase({})
    const target = document.createElement('div')
    document.body.appendChild(target)
    let settleIt: { resolve: () => void; reject: (e: Error) => void } | null = null
    let form: ReturnType<typeof mount> | null = null
    try {
      await until(() => !!t.api, 'the grid')
      form = mount(SvBaseForm as any, {
        target,
        props: {
          api: t.api,
          fields: ['task'],
          onSubmit: () => new Promise<void>((resolve, reject) => (settleIt = { resolve, reject })),
        },
      })
      flushSync()
      const rows = () => gridOf(t.api).internalData.length
      const before = rows()
      await typeInto(target, 'Task', 'Pending one')
      submit(target)
      const button = target.querySelector('.sv-fform-submit') as HTMLButtonElement
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('aria-busy')).toBe('true')
      settleIt!.reject(new Error('Server said no'))
      await until(() => !!target.querySelector('.sv-fform-failure'), 'the error')
      expect(target.querySelector('.sv-fform-failure')?.textContent?.trim()).toBe('Server said no')
      expect(target.querySelector('.sv-fform-done')).toBeNull()
      expect(shown(target, 'Task')).toBe('Pending one')
      expect((target.querySelector('.sv-fform-submit') as HTMLButtonElement).disabled).toBe(false)
      expect(rows()).toBe(before)

      submit(target)
      settleIt!.resolve()
      await until(() => !!target.querySelector('.sv-fform-done'), 'the thank-you')
      expect(rows()).toBe(before + 1)
    } finally {
      if (form) unmount(form)
      target.remove()
      t.destroy()
    }
  })

  it('gives a record from a form an id in a base table without a row adder', async () => {
    const tables: BaseTable[] = [
      {
        id: 'tasks',
        name: 'Tasks',
        primaryField: 'task',
        columns: [{ id: 'task', field: 'task', header: 'Task', fieldType: 'text' }],
        data: [],
        views: [{ id: 'f', name: 'Ask', type: 'form' }],
        props: { rowAdder: false },
      },
    ]
    let saved: BaseTable[] = []
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(SvBase as any, { target, props: { tables, editable: true, containerHeight: 400, onTablesChange: (next: BaseTable[]) => (saved = next) } })
    flushSync()
    try {
      await until(() => !!target.querySelector('.sv-fform'), 'the form')
      await typeInto(target, 'Task', 'No adder')
      submit(target)
      await until(() => saved[0]?.data.length === 1, 'the saved record')
      expect(saved[0]!.data[0]).toMatchObject({ task: 'No adder' })
      expect(String(saved[0]!.data[0]!.id ?? '')).not.toBe('')
    } finally {
      unmount(app)
      target.remove()
    }
  })
})
