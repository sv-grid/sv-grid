/**
 * The long text editor: Enter is a new line, Ctrl+Enter saves, Escape leaves
 * the cell as it was, and a rich text field names its markup.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import LongTextEditor from './LongTextEditor.svelte'

enableFields()

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

function open(value: unknown, fieldProps: Record<string, unknown> = {}) {
  const calls = { commit: [] as unknown[], cancel: 0 }
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(LongTextEditor, {
    target,
    props: {
      value,
      columnDef: fillFieldColumn({ field: 'notes', header: 'Notes', fieldType: 'longText', fieldProps }),
      onCommit: (v?: unknown) => calls.commit.push(v),
      onCancel: () => (calls.cancel += 1),
    },
  })
  flushSync()
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  const area = document.querySelector<HTMLTextAreaElement>('.sv-flt-area')!
  const key = (k: string, mods: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods })
    area.dispatchEvent(e)
    flushSync()
    return e.defaultPrevented
  }
  const type = (text: string) => {
    area.value = text
    area.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
  }
  return { calls, area, key, type }
}

describe('long text editor', () => {
  it('Enter is left to the text box (a new line); Ctrl+Enter saves the lines', () => {
    const ed = open('First')
    expect(ed.area.value).toBe('First')
    expect(ed.key('Enter')).toBe(false)
    expect(ed.calls.commit).toEqual([])
    ed.type('First\nSecond')
    ed.key('Enter', { ctrlKey: true })
    expect(ed.calls.commit).toEqual(['First\nSecond'])
  })

  it('Escape leaves the cell as it was; an emptied box clears it', () => {
    const ed = open('Keep')
    ed.type('Changed')
    ed.key('Escape')
    expect(ed.calls.cancel).toBe(1)
    cleanup?.()
    const ed2 = open('Gone')
    ed2.type('')
    ed2.key('Enter', { metaKey: true })
    expect(ed2.calls.commit).toEqual([null])
  })

  it('names the markup when the field draws rich text', () => {
    open('x', { richText: true })
    expect(document.querySelector('.sv-flt-markup')?.textContent).toContain('**bold**')
    cleanup?.()
    open('x')
    expect(document.querySelector('.sv-flt-markup')).toBeNull()
  })
})
