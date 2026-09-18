/**
 * `SvRowGroupPanel` in deferred mode: chips edit a local copy, `onChange`
 * fires once on Apply with the whole change, Cancel drops it, and a new
 * `groupBy` from outside discards what was pending.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvRowGroupPanel from './SvRowGroupPanel.svelte'

const columns = [
  { id: 'region', label: 'Region' },
  { id: 'country', label: 'Country' },
  { id: 'rep', label: 'Rep' },
]

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) unmount(comp)
  host?.remove()
  comp = null
  host = null
})

function render(props: Record<string, unknown>) {
  host = document.createElement('div')
  document.body.appendChild(host)
  const state = $state({ groupBy: ['region', 'country'] as string[] })
  comp = mount(SvRowGroupPanel, {
    target: host,
    props: {
      columns,
      get groupBy() {
        return state.groupBy
      },
      ...props,
    } as never,
  })
  flushSync()
  return { host, state }
}

const chips = (el: HTMLElement) =>
  [...el.querySelectorAll('.sv-rgp-chip')].map((c) => c.querySelector('.sv-rgp-x')!.getAttribute('aria-label')!.replace('Stop grouping by ', ''))
const button = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('.sv-rgp-apply button')].find((b) => b.textContent === label)!

describe('SvRowGroupPanel applyMode="deferred"', () => {
  it('collects edits and sends them once on Apply', () => {
    const onChange = vi.fn()
    const { host } = render({ applyMode: 'deferred', onChange })
    expect(button(host, 'Apply').disabled).toBe(true)

    host.querySelector<HTMLButtonElement>('.sv-rgp-x')!.click()
    flushSync()
    expect(chips(host)).toEqual(['Country'])
    expect(onChange).not.toHaveBeenCalled()
    expect(button(host, 'Apply').disabled).toBe(false)

    const select = host.querySelector<HTMLSelectElement>('select.sv-rgp-add')!
    select.value = 'rep'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    flushSync()
    expect(chips(host)).toEqual(['Country', 'Rep'])
    expect(onChange).not.toHaveBeenCalled()

    button(host, 'Apply').click()
    flushSync()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['country', 'rep'])
  })

  it('drops pending edits on Cancel', () => {
    const onChange = vi.fn()
    const { host } = render({ applyMode: 'deferred', onChange })
    host.querySelector<HTMLButtonElement>('.sv-rgp-x')!.click()
    flushSync()
    expect(chips(host)).toEqual(['Country'])
    button(host, 'Cancel').click()
    flushSync()
    expect(chips(host)).toEqual(['Region', 'Country'])
    expect(onChange).not.toHaveBeenCalled()
    expect(button(host, 'Apply').disabled).toBe(true)
  })

  it('discards pending edits when groupBy changes from outside', () => {
    const { host, state } = render({ applyMode: 'deferred', onChange: () => {} })
    host.querySelector<HTMLButtonElement>('.sv-rgp-x')!.click()
    flushSync()
    expect(chips(host)).toEqual(['Country'])
    state.groupBy = ['rep']
    flushSync()
    expect(chips(host)).toEqual(['Rep'])
    expect(button(host, 'Apply').disabled).toBe(true)
  })

  it('shows no Apply / Cancel in immediate mode and calls onChange at once', () => {
    const onChange = vi.fn()
    const { host } = render({ onChange })
    expect(host.querySelector('.sv-rgp-apply')).toBeNull()
    host.querySelector<HTMLButtonElement>('.sv-rgp-x')!.click()
    expect(onChange).toHaveBeenCalledWith(['country'])
  })
})
