/**
 * End-to-end: typing a decimal into an `editorType: 'number'` cell keeps every
 * keystroke, and the value still commits as a NUMBER.
 *
 * The unit half of this lives in `number-editor-literal.test.ts` - the browser
 * sanitization that caused it, and the helpers that route around it. This
 * drives the real editor, which is what actually regressed for users: typing
 * "12.5" produced 125, because the "." was dropped and the digits ran together.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { createCoreRowModel, tableFeatures } from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; label: string; amount: number }
const features = tableFeatures({})
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'label', header: 'Label', width: 160 },
  { field: 'amount', header: 'Amount', width: 140, editorType: 'number' },
]

function mountGrid() {
  return new Promise<{
    api: SvGridApi<typeof features, Row>
    target: HTMLElement
    changes: Array<{ newValue: unknown }>
    destroy: () => void
  }>((res, rej) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const changes: Array<{ newValue: unknown }> = []
    const app = mount(SvGrid, {
      target,
      props: {
        data: [{ id: 1, label: 'One', amount: 5 }],
        columns: cols,
        features,
        _rowModels: { coreRowModel: createCoreRowModel() },
        getRowId: (r: Row) => String(r.id),
        containerHeight: 200,
        virtualization: false,
        editable: true,
        onCellValueChange: (e: { newValue: unknown }) => changes.push(e),
        onApiReady(api: SvGridApi<typeof features, Row>) {
          res({ api, target, changes, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
  })
}

/** Start editing the amount cell and return its input, once the lazy chunk lands. */
async function editAmount(api: SvGridApi<typeof features, Row>, target: HTMLElement) {
  api.startEditing(0, 'amount')
  await vi.waitFor(() => {
    expect(target.querySelector('.sv-grid-cell-editing input')).not.toBeNull()
  })
  return target.querySelector('.sv-grid-cell-editing input') as HTMLInputElement
}

/** Type `text` one character at a time, as a user does. */
function typeInto(input: HTMLInputElement, text: string) {
  let sofar = ''
  for (const ch of text) {
    sofar += ch
    input.value = sofar
    input.dispatchEvent(new Event('input', { bubbles: true }))
    // Read back what survived - the element may have rewritten it.
    sofar = input.value
  }
  return input.value
}

describe('number editor - decimals survive being typed', () => {
  it('keeps the trailing decimal point mid-entry', async () => {
    const { api, target, destroy } = await mountGrid()
    try {
      const input = await editAmount(api, target)
      // The bug: with type="number" this read back "" and the dot was gone.
      expect(typeInto(input, '12.')).toBe('12.')
    } finally {
      destroy()
    }
  })

  it('commits 12.5 as the number 12.5, not 125', async () => {
    const { api, target, changes, destroy } = await mountGrid()
    try {
      const input = await editAmount(api, target)
      typeInto(input, '12.5')
      input.dispatchEvent(new Event('blur', { bubbles: true }))

      await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0))
      expect(changes.at(-1)!.newValue).toBe(12.5)
      expect(typeof changes.at(-1)!.newValue).toBe('number')
    } finally {
      destroy()
    }
  })

  it('keeps a lone minus sign on the way to a negative', async () => {
    const { api, target, changes, destroy } = await mountGrid()
    try {
      const input = await editAmount(api, target)
      expect(typeInto(input, '-')).toBe('-')
      typeInto(input, '-4.25')
      input.dispatchEvent(new Event('blur', { bubbles: true }))

      await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0))
      expect(changes.at(-1)!.newValue).toBe(-4.25)
    } finally {
      destroy()
    }
  })

  it('carries the mobile decimal keypad hint', async () => {
    // Losing type="number" also loses the numeric soft keyboard, which is what
    // inputmode restores.
    const { api, target, destroy } = await mountGrid()
    try {
      const input = await editAmount(api, target)
      expect(input.getAttribute('type')).toBe('text')
      expect(input.getAttribute('inputmode')).toBe('decimal')
    } finally {
      destroy()
    }
  })

  it('refuses characters that can never be part of a number', async () => {
    // type="number" used to block these; a text input does not, so the editor
    // has to. Without the guard "12x" would reach the commit and coerce to null.
    const { api, target, destroy } = await mountGrid()
    try {
      const input = await editAmount(api, target)
      typeInto(input, '12')
      input.value = '12x'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      expect(input.value).toBe('12')
    } finally {
      destroy()
    }
  })

  it('leaves a text column alone', async () => {
    const { api, target, destroy } = await mountGrid()
    try {
      api.startEditing(0, 'label')
      await vi.waitFor(() => {
        expect(target.querySelector('.sv-grid-cell-editing input')).not.toBeNull()
      })
      const input = target.querySelector('.sv-grid-cell-editing input') as HTMLInputElement
      expect(input.getAttribute('inputmode')).toBeNull()
      expect(typeInto(input, 'hello.')).toBe('hello.')
    } finally {
      destroy()
    }
  })
})
