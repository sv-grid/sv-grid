import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSheetManageRules from './SvSheetManageRules.svelte'
import type { CfRule, CfStyledRule } from './sheet/conditional-formats'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host) })
const qa = (sel: string) => [...document.querySelectorAll(sel)]
const button = (label: string) => qa('.sv-modal button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement
const click = (el: Element | undefined | null) => { el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); flushSync() }

const rules: CfRule[] = [
  { id: 'i', kind: 'iconSet', set: 'arrows', rects: [[1, 3, 3, 3]] },
  { id: 'b', kind: 'dataBar', color: '#638EC6', rects: [[1, 1, 3, 1]] },
  { id: 'g', kind: 'cellIs', operator: 'greater', value1: '5', rects: [[1, 4, 3, 4]], style: { fill: '#FFC7CE' } },
]

describe('SvSheetManageRules (DOM)', () => {
  it('lists the rules in order, narrows to the selection, moves and deletes, and hands the working copy back on OK', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetManageRules, { target: host!, props: { open: true, rules, selection: [[1, 3, 3, 3]], onApply, onEdit: vi.fn() } })
    flushSync()
    const what = () => qa('.sv-modal .rule .what').map((e) => e.textContent)
    expect(what()).toEqual(['Icon Set', 'Data Bar', 'Cell Value greater than 5'])
    expect(qa('.sv-modal .rule .where').map((e) => e.textContent)).toEqual(['D2:D4', 'B2:B4', 'E2:E4'])
    const scope = document.querySelector<HTMLSelectElement>('.sv-modal select')!
    scope.value = 'selection'; scope.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    expect(what()).toEqual(['Icon Set'])
    scope.value = 'sheet'; scope.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    // Select the last, move it up, delete the first.
    click(qa('.sv-modal .rule')[2])
    click(document.querySelector('.sv-modal button[aria-label="Move Up"]'))
    expect(what()).toEqual(['Icon Set', 'Cell Value greater than 5', 'Data Bar'])
    click(qa('.sv-modal .rule')[0])
    click(button('Delete Rule'))
    expect(what()).toEqual(['Cell Value greater than 5', 'Data Bar'])
    click(button('OK'))
    expect(onApply.mock.calls[0]![0].map((r: CfRule) => r.id)).toEqual(['g', 'b'])
  })

  it('Edit Rule hands the styled rule to the shell and takes the replacement', () => {
    const onApply = vi.fn()
    const onEdit = vi.fn((rule: CfStyledRule, replace: (next: CfStyledRule) => void) => replace({ ...rule, kind: 'cellIs', operator: 'less', value1: '1', style: { fill: '#000000' } } as CfStyledRule))
    comp = mount(SvSheetManageRules, { target: host!, props: { open: true, rules, selection: [], onApply, onEdit } })
    flushSync()
    click(qa('.sv-modal .rule')[0])
    expect(button('Edit Rule...').disabled).toBe(true)
    click(qa('.sv-modal .rule')[2])
    expect(button('Edit Rule...').disabled).toBe(false)
    click(button('Edit Rule...'))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(qa('.sv-modal .rule .what')[2]!.textContent).toBe('Cell Value less than 1')
    click(button('OK'))
    expect(onApply.mock.calls[0]![0][2]).toMatchObject({ id: 'g', operator: 'less' })
  })
})
