/**
 * Component tests for SvCommand, exercising the shared createCommand core: the
 * global hotkey toggles it open, typing fuzzy-filters the list, arrow+Enter runs
 * the active command, and clicking a command runs it and closes the palette.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvCommand, { type CommandItem } from './SvCommand.svelte'

function mountCmd(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvCommand, { target, props: props as any })
  flushSync()
  return { destroy: () => { unmount(app); target.remove() } }
}
const palette = () => document.querySelector<HTMLElement>('.sv-cmd')
const options = () => [...document.querySelectorAll<HTMLElement>('.sv-cmd__opt')]
const input = () => document.querySelector<HTMLInputElement>('.sv-cmd__input')
afterEach(() => document.querySelectorAll('.sv-cmd__backdrop').forEach((n) => n.remove()))

const commands: CommandItem[] = [
  { id: 'a', label: 'New File' },
  { id: 'b', label: 'Open Folder' },
  { id: 'c', label: 'Save All' },
]

describe('SvCommand', () => {
  it('opens on the Cmd/Ctrl+K hotkey', () => {
    const { destroy } = mountCmd({ open: false, commands })
    try {
      expect(palette()).toBeNull()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      flushSync()
      expect(palette()).not.toBeNull()
      expect(options().length).toBe(3)
    } finally { destroy() }
  })

  it('fuzzy-filters as you type', () => {
    const { destroy } = mountCmd({ open: true, commands })
    try {
      const el = input()!
      el.value = 'save'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      flushSync()
      const labels = options().map((o) => o.textContent)
      expect(labels.length).toBe(1)
      expect(labels[0]).toContain('Save All')
    } finally { destroy() }
  })

  it('runs the active command on Enter and closes', () => {
    const onRun = vi.fn()
    const { destroy } = mountCmd({ open: true, commands, onRun })
    try {
      const el = input()!
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      flushSync()
      expect(onRun).toHaveBeenCalledTimes(1)
      expect(onRun.mock.calls[0]![0].id).toBe('b') // ArrowDown moved 0 -> 1
      expect(palette()).toBeNull()
    } finally { destroy() }
  })

  it('runs a command on click and closes', () => {
    const onRun = vi.fn()
    const { destroy } = mountCmd({ open: true, commands, onRun })
    try {
      options()[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      flushSync()
      expect(onRun.mock.calls[0]![0].id).toBe('c')
      expect(palette()).toBeNull()
    } finally { destroy() }
  })
})
