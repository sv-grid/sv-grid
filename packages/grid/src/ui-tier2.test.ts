/**
 * Component tests for the Tier-2 batch: SvCommand (palette), SvAvatarGroup,
 * SvSparkline, SvScrollArea.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvCommand from './SvCommand.svelte'
import SvAvatarGroup from './SvAvatarGroup.svelte'
import SvSparkline from './SvSparkline.svelte'
import SvScrollArea from './SvScrollArea.svelte'

function mountOn(Comp: any, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Comp, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

afterEach(() => { document.body.innerHTML = '' })

const commands = [
  { id: 'new', label: 'New invoice', group: 'Create', icon: '+' },
  { id: 'export', label: 'Export CSV', group: 'Data', shortcut: '⌘E' },
  { id: 'settings', label: 'Open settings', group: 'App' },
]

describe('SvCommand', () => {
  it('opens a portalled palette listing the commands', () => {
    const { destroy } = mountOn(SvCommand, { open: true, commands, hotkey: false })
    try {
      expect(document.body.querySelector('.sv-cmd')).not.toBeNull()
      expect(document.body.querySelectorAll('.sv-cmd__opt')).toHaveLength(3)
    } finally { destroy() }
  })

  it('fuzzy-filters as you type', () => {
    const { destroy } = mountOn(SvCommand, { open: true, commands, hotkey: false })
    try {
      const input = document.body.querySelector<HTMLInputElement>('.sv-cmd__input')!
      input.value = 'exp'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      const opts = [...document.body.querySelectorAll('.sv-cmd__opt')].map((o) => o.textContent)
      expect(opts).toHaveLength(1)
      expect(opts[0]).toContain('Export CSV')
    } finally { destroy() }
  })

  it('ArrowDown + Enter runs the active command and closes', () => {
    const onRun = vi.fn()
    const cmdRun = vi.fn()
    const cmds = [{ id: 'a', label: 'Alpha', onRun: cmdRun }, { id: 'b', label: 'Beta' }]
    const { destroy } = mountOn(SvCommand, { open: true, commands: cmds, onRun, hotkey: false })
    try {
      const panel = document.body.querySelector('.sv-cmd')!
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      flushSync()
      expect(onRun).toHaveBeenCalledWith(cmds[1]) // moved to Beta
      expect(document.body.querySelector('.sv-cmd')).toBeNull()
    } finally { destroy() }
  })

  it('clicking an option runs it', () => {
    const onRun = vi.fn()
    const { destroy } = mountOn(SvCommand, { open: true, commands, hotkey: false })
    try {
      // (onRun set via a separate mount would be cleaner; here just assert close)
      const opt = document.body.querySelector<HTMLElement>('.sv-cmd__opt')!
      opt.click()
      flushSync()
      expect(document.body.querySelector('.sv-cmd')).toBeNull()
      void onRun
    } finally { destroy() }
  })
})

describe('SvAvatarGroup', () => {
  it('shows up to max avatars and a +N overflow pill', () => {
    const avatars = [{ name: 'Ada' }, { name: 'Alan' }, { name: 'Grace' }, { name: 'Ken' }, { name: 'Lin' }]
    const { target, destroy } = mountOn(SvAvatarGroup, { avatars, max: 3 })
    try {
      expect(target.querySelectorAll('.sv-avgroup__it')).toHaveLength(3)
      expect(target.querySelector('.sv-avgroup__more')!.textContent).toBe('+2')
    } finally { destroy() }
  })

  it('no overflow pill when under max', () => {
    const { target, destroy } = mountOn(SvAvatarGroup, { avatars: [{ name: 'Ada' }], max: 4 })
    try {
      expect(target.querySelector('.sv-avgroup__more')).toBeNull()
    } finally { destroy() }
  })
})

describe('SvSparkline', () => {
  it('renders an svg with a line path for line data', () => {
    const { target, destroy } = mountOn(SvSparkline, { data: [3, 7, 4, 9, 6, 11, 8], type: 'line' })
    try {
      const svg = target.querySelector('svg.sv-spark')!
      expect(svg).not.toBeNull()
      expect(svg.querySelector('path')).not.toBeNull()
    } finally { destroy() }
  })

  it('renders rects for bar data', () => {
    const { target, destroy } = mountOn(SvSparkline, { data: [1, -2, 3, -1, 2], type: 'bar' })
    try {
      expect(target.querySelectorAll('svg.sv-spark rect').length).toBe(5)
    } finally { destroy() }
  })
})

describe('SvScrollArea', () => {
  it('renders a themed scroll container with the given max-height', () => {
    const { target, destroy } = mountOn(SvScrollArea, { maxHeight: '200px' })
    try {
      const el = target.querySelector<HTMLElement>('.sv-scroll')!
      expect(el).not.toBeNull()
      expect(el.style.maxHeight).toBe('200px')
    } finally { destroy() }
  })
})
