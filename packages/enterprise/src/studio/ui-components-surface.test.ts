import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import { GENERATED_UI_SURFACE } from './ui-components.generated'
import { UI_COMPONENT_REGISTRY, uiComponentSpec } from './ui-components'
import { addComponentBlock, addFreestandingScreen, createProject, eventSlot, setHandlerBody, setHandlerSteps } from './project'
import { emitStudioProject } from './emit-project'
import type { EntitySchema } from '../schema'

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customers',
  idField: 'id',
  fields: [
    { field: 'id', label: 'Id', type: 'text', primaryKey: true },
    { field: 'name', label: 'Name', type: 'text' },
  ],
}

describe('full component surface (extractor-driven)', () => {
  it('the generated surface is current (regen --check)', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    // Throws (non-zero exit) when a kit prop change was not re-extracted.
    expect(() => execFileSync(process.execPath, [join(here, '../../scripts/extract-ui-props.mjs'), '--check'], { encoding: 'utf8' })).not.toThrow()
  })

  it('every registered component has an extracted surface, tooltips, and events metadata', () => {
    for (const spec of UI_COMPONENT_REGISTRY) {
      const generated = GENERATED_UI_SURFACE[spec.importName]
      expect(generated, `${spec.key} (${spec.importName}) missing from the extractor's COMPONENTS list`).toBeTruthy()
      // The merged registry exposes the FULL surface, not just curated chrome.
      expect(spec.props.length, `${spec.key} lost extracted props in the merge`).toBeGreaterThanOrEqual(generated!.props.length - (spec.hiddenProps?.length ?? 0) - (spec.fixed?.length ?? 0))
      // Guidance exists: at least one prop carries a JSDoc-sourced tooltip.
      // (Components whose surface is fully hand-curated chrome may have none.)
      if (generated!.props.some((p) => p.description)) {
        expect(spec.props.some((p) => p.description), `${spec.key} dropped descriptions in the merge`).toBe(true)
      }
    }
  })

  it('every registered component emits and its screen compiles', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Kitchen sink', route: 'sink' })
    const sid = p.screens.find((s) => s.title === 'Kitchen sink')!.id
    for (const spec of UI_COMPONENT_REGISTRY) p = addComponentBlock(p, sid, spec.key)
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/sink/+page.svelte')!
    for (const spec of UI_COMPONENT_REGISTRY) expect(page.contents, `missing <${spec.importName}`).toContain(`<${spec.importName}`)
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('json props emit as literal expressions (radio group options)', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'R', route: 'r' })
    const sid = p.screens.find((s) => s.title === 'R')!.id
    p = addComponentBlock(p, sid, 'radio-group')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/r/+page.svelte')!.contents
    expect(page).toMatch(/options=\{\[\{"value":"a","label":"Option A"\}/)
  })

  it('every component exposes the full standard DOM event surface (wired + wireable)', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'E', route: 'e' })
    const sid = p.screens.find((s) => s.title === 'E')!.id
    p = addComponentBlock(p, sid, 'button')
    const block = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!
    // The wrapper forwards focus/blur (focusin/focusout), keydown, contextmenu, ...
    p = setHandlerSteps(p, sid, eventSlot('keydown', block.id), [{ type: 'alert', message: 'k' }])
    p = setHandlerSteps(p, sid, eventSlot('focus', block.id), [{ type: 'alert', message: 'f' }])
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/e/+page.svelte')!.contents
    expect(page).toMatch(/onkeydown=\{\(e\) => \w+\.fire\('keydown', e\)\}/)
    expect(page).toMatch(/onfocusin=\{\(e\) => \w+\.fire\('focus', e\)\}/) // focus via focusin
    expect(page).toMatch(/onfocusout=\{\(e\) => \w+\.fire\('blur', e\)\}/)
    expect(page).toMatch(/oncontextmenu=\{\(e\) => \w+\.fire\('contextmenu', e\)\}/)
    const handlers = files.find((f) => f.path === 'src/routes/e/handlers.ts')!.contents
    expect(handlers).toMatch(/\.onkeydown = async \(\) => \{/)
    expect(handlers).toMatch(/\.onfocus = async \(\) => \{/)
    expect(() => compile(page, { filename: 'e.svelte', generate: 'client' })).not.toThrow()
  })

  it('the handle proxy honors a camelCase on<Event> assignment (ctx.x.onKeyDown = fn)', () => {
    // Double-click inserts `ctx.list_box1.onKeyDown = (e) => {}` into onLoad; the wrapper
    // fires the lowercase DOM key ('keydown'), so the proxy must normalize casing.
    let p = addFreestandingScreen(createProject([customers]), { title: 'K', route: 'k' })
    const sid = p.screens.find((s) => s.title === 'K')!.id
    p = addComponentBlock(p, sid, 'list-box')
    // Double-clicking an event writes `ctx.list_box1.onKeyDown = (e) => {}` into onLoad (code mode).
    p = setHandlerBody(p, sid, 'onLoad', 'ctx.list_box1.onKeyDown = (e) => {}')
    const handles = emitStudioProject(p).find((f) => f.path === 'src/lib/handles.svelte.ts')!.contents
    // onEvent + fire both lowercase, so onKeyDown, onkeydown and fire('keydown') all agree.
    expect(handles).toContain('[name.toLowerCase()]: fn')
    expect(handles).toContain('this.on[name.toLowerCase()]?.(e)')
    // The set trap accepts any on<Event> casing (onKeyDown = fn), not just lowercase.
    expect(handles).toContain('/^on[A-Za-z]/.test(k)) { t.onEvent(k.slice(2), v')
  })

  it('declared events wire through the component callback prop + a method slot each', () => {
    const spec = uiComponentSpec('tree')!
    expect(spec.events!.map((e) => e.key)).toEqual(expect.arrayContaining(['select', 'toggle', 'check']))
    // Steps on a non-click/change event compile to ctx.<name>.on<event> wiring.
    let p = addFreestandingScreen(createProject([customers]), { title: 'T', route: 't' })
    const sid = p.screens.find((s) => s.title === 'T')!.id
    p = addComponentBlock(p, sid, 'tree')
    const block = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!
    p = setHandlerSteps(p, sid, eventSlot('select', block.id), [{ type: 'alert', message: 'picked' }])
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/t/+page.svelte')!.contents
    expect(page).toMatch(/onSelect=\{\(e\) => \w+\.fire\('select', e\)\}/)
    // The visual steps compile into the handlers companion, wired via the handle.
    const handlers = files.find((f) => f.path === 'src/routes/t/handlers.ts')!.contents
    expect(handlers).toMatch(/\.onselect = async \(\) => \{/)
    expect(handlers).toContain("alert('picked')")
  })
})
