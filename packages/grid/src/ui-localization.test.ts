/**
 * Every user-facing string in the kit must be overridable.
 *
 * These components shipped chrome copy - toolbar tooltips, "No matches", the
 * lazy-load placeholder, search-box labels - baked in as literals, so an app in
 * any other language had English fragments it could not reach. Each is now a
 * prop; these tests pin that down so the strings cannot quietly go back to
 * being hard-coded.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvRichText from './SvRichText.svelte'
import SvMultiSelect from './SvMultiSelect.svelte'
import SvGridSelect from './SvGridSelect.svelte'
import SvTree from './SvTree.svelte'

function mnt(Comp: unknown, props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = mount(Comp as any, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  document.querySelectorAll('.sv-ms__panel, .sv-gs__panel').forEach((n) => n.remove())
})

describe('SvRichText localization', () => {
  it('defaults to English toolbar labels', () => {
    const g = mnt(SvRichText, {})
    cleanup = g.destroy
    const bold = g.target.querySelector('[data-tool="bold"]')!
    expect(bold.getAttribute('title')).toBe('Bold')
    expect(bold.getAttribute('aria-label')).toBe('Bold')
    expect(g.target.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).toBe('Formatting')
  })

  it('takes per-tool overrides through `messages`', () => {
    const g = mnt(SvRichText, { messages: { bold: 'Fett', italic: 'Kursiv', toolbar: 'Formatierung' } })
    cleanup = g.destroy
    const bold = g.target.querySelector('[data-tool="bold"]')!
    expect(bold.getAttribute('title')).toBe('Fett')
    expect(bold.getAttribute('aria-label')).toBe('Fett')
    expect(g.target.querySelector('[data-tool="italic"]')!.getAttribute('title')).toBe('Kursiv')
    expect(g.target.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).toBe('Formatierung')
    // An un-overridden key keeps its default rather than going blank.
    expect(g.target.querySelector('[data-tool="underline"]')!.getAttribute('title')).toBe('Underline')
  })

  it('keeps the glyphs fixed - they are not language-dependent', () => {
    const g = mnt(SvRichText, { messages: { bold: 'Fett' } })
    cleanup = g.destroy
    expect(g.target.querySelector('[data-tool="bold"]')!.textContent?.trim()).toBe('B')
  })
})

describe('empty / search text is overridable', () => {
  it('SvMultiSelect emptyText + search chrome', () => {
    const g = mnt(SvMultiSelect, {
      options: [],
      emptyText: 'Keine Treffer',
      searchPlaceholder: 'Suchen…',
      searchLabel: 'Optionen suchen',
    })
    cleanup = g.destroy
    g.target.querySelector<HTMLButtonElement>('.sv-ms__trigger')?.click()
    flushSync()
    const panel = document.querySelector('.sv-ms__panel')
    expect(panel?.textContent).toContain('Keine Treffer')
    const search = panel?.querySelector('input')
    expect(search?.getAttribute('placeholder')).toBe('Suchen…')
    expect(search?.getAttribute('aria-label')).toBe('Optionen suchen')
  })

  it('SvGridSelect emptyText + search chrome', () => {
    const g = mnt(SvGridSelect, {
      columns: [{ field: 'name', header: 'Name' }],
      options: [],
      emptyText: 'Sin resultados',
      searchPlaceholder: 'Buscar…',
      searchLabel: 'Buscar opciones',
    })
    cleanup = g.destroy
    g.target.querySelector<HTMLButtonElement>('.sv-gs__trigger')?.click()
    flushSync()
    const panel = document.querySelector('.sv-gs__panel')
    expect(panel?.textContent).toContain('Sin resultados')
    const search = panel?.querySelector('input')
    expect(search?.getAttribute('placeholder')).toBe('Buscar…')
    expect(search?.getAttribute('aria-label')).toBe('Buscar opciones')
  })

  it('SvTree lazy-load placeholder', async () => {
    let resolveKids: (v: Array<{ id: string; label: string }>) => void = () => {}
    const g = mnt(SvTree, {
      nodes: [{ id: 'root', label: 'Root', lazy: true }],
      loadChildren: () => new Promise<Array<{ id: string; label: string }>>((r) => { resolveKids = r }),
      loadingText: 'Chargement…',
    })
    cleanup = g.destroy
    g.target.querySelector<HTMLElement>('.sv-tree__twist')?.click()
    flushSync()
    await Promise.resolve()
    flushSync()
    expect(g.target.textContent).toContain('Chargement…')
    resolveKids([{ id: 'kid', label: 'Child' }])
  })
})
