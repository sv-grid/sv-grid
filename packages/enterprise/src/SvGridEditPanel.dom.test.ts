/**
 * The repo's first runtime (DOM) test: mount SvGridEditPanel in jsdom and assert
 * it renders the *rich* editor suite (not bare native inputs) and round-trips a
 * row's values - the path that was previously only compile-checked. Enabled by
 * the svelte plugin in vite.config.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGridEditPanel from './SvGridEditPanel.svelte'
import type { EntitySchema } from './schema'
import { getSampleApp } from './studio/samples/index'

type Customer = { id: string; name: string; mrr: number; active: boolean; tier: string }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'mrr', type: 'number' },
    { field: 'active', type: 'boolean' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
  ],
}

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null

afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function render(props: Record<string, unknown>): HTMLElement {
  // Tear down a previous mount first: a test that renders more than once used to
  // leak every panel but the last, leaving live components (and duplicate field
  // ids) in the document for whatever ran next.
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvGridEditPanel, { target: host, props })
  flushSync()
  return host
}

describe('SvGridEditPanel (DOM)', () => {
  it('mounts and renders each field with its rich editor, seeded from the row', () => {
    const el = render({
      schema,
      row: { id: '1', name: 'Ada', mrr: 1200, active: true, tier: 'pro' },
      presentation: 'inline',
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    })

    // Field labels are present.
    expect(el.textContent).toContain('Name')
    expect(el.textContent).toContain('Mrr')

    // number -> SvNumberInput (its .sv-num__input), not a bare <input type="number">.
    const numInput = el.querySelector<HTMLInputElement>('.sv-num__input')
    expect(numInput).toBeTruthy()
    expect(numInput!.value).toBe('1200') // seeded from the row

    // boolean -> SvSwitchButton, on because active === true.
    const sw = el.querySelector('.sv-switch')
    expect(sw).toBeTruthy()
    expect(sw!.classList.contains('is-on')).toBe(true)

    // The primary action reads "Save" in edit mode.
    const submit = el.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(submit?.textContent?.trim()).toBe('Save')
  })

  it('is in create mode with no row (empty number, switch off, "Create" button)', () => {
    const el = render({ schema, presentation: 'inline', onSubmit: vi.fn(), onCancel: vi.fn() })
    expect(el.querySelector<HTMLInputElement>('.sv-num__input')!.value).toBe('') // empty, not "0"
    expect(el.querySelector('.sv-switch')!.classList.contains('is-on')).toBe(false)
    expect(el.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Create')
  })

  it('routes each editorType to its rich editor from the suite', () => {
    const rich: EntitySchema = {
      name: 'assets',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'brand', type: 'text', input: { editorType: 'color' } },
        { field: 'secret', type: 'text', input: { editorType: 'password' } },
        { field: 'labels', type: 'text', input: { editorType: 'chips' } },
        { field: 'due', type: 'date' },
        { field: 'phone', type: 'text', input: { editorType: 'phone' } },
        { field: 'score', type: 'number', input: { editorType: 'slider' }, min: 0, max: 10 },
      ],
    }
    const el = render({
      schema: rich,
      row: { id: '1', brand: '#ff0000', secret: 'pw', labels: 'a,b', due: '2024-01-02', phone: '+14155550100', score: 7 },
      presentation: 'inline',
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    })
    expect(el.querySelector('.sv-color')).toBeTruthy()  // color -> SvColorInput
    expect(el.querySelector('.sv-pw')).toBeTruthy()     // password -> SvPasswordInput
    expect(el.querySelector('.sv-tags')).toBeTruthy()   // chips -> SvTagsInput
    expect(el.querySelector('.sv-dtp')).toBeTruthy()    // date -> SvDateTimePicker
    expect(el.querySelector('.sv-phone')).toBeTruthy()  // phone -> SvPhoneInput
    expect(el.querySelector('.sv-slider')).toBeTruthy() // slider -> SvSlider
  })

  it('renders the enriched CRM sample forms with real editors (samples <-> edit panel)', () => {
    const proj = getSampleApp('crm')!.build()
    const entity = (name: string) => proj.entities.find((e) => e.name === name)!
    const firstRow = (name: string) => (proj.dataSources?.[name] as { seed?: Record<string, unknown>[] }).seed![0]!

    // Contacts: phone -> SvPhoneInput, segments (chips) -> SvTagsInput.
    const contacts = render({ schema: entity('contacts'), row: firstRow('contacts'), presentation: 'inline', onSubmit: vi.fn(), onCancel: vi.fn() })
    expect(contacts.querySelector('.sv-phone')).toBeTruthy()
    expect(contacts.querySelector('.sv-tags')).toBeTruthy()

    // Deals: probability -> SvSlider (rendered for slider editorType).
    const deals = render({ schema: entity('deals'), row: firstRow('deals'), presentation: 'inline', onSubmit: vi.fn(), onCancel: vi.fn() })
    expect(deals.querySelector('.sv-slider')).toBeTruthy()

    // Companies: country -> SvCountryInput, health (rating) -> SvSlider.
    const companies = render({ schema: entity('companies'), row: firstRow('companies'), presentation: 'inline', onSubmit: vi.fn(), onCancel: vi.fn() })
    expect(companies.querySelector('.sv-country')).toBeTruthy()
    expect(companies.querySelector('.sv-slider')).toBeTruthy()
  })

  it('submits the row values (edit mode, readonly id omitted)', async () => {
    const onSubmit = vi.fn()
    const el = render({
      schema,
      row: { id: '1', name: 'Ada', mrr: 1200, active: true, tier: 'pro' },
      presentation: 'inline',
      onSubmit,
      onCancel: vi.fn(),
    })
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    // Submit validates asynchronously before calling onSubmit.
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0]![0] as { mode: string; id: string | null; values: Record<string, unknown> }
    expect(payload.mode).toBe('edit')
    expect(payload.id).toBe('1')
    expect(payload.values).toMatchObject({ name: 'Ada', mrr: 1200, active: true, tier: 'pro' })
    expect(payload.values).not.toHaveProperty('id') // readonly PK is never submitted
  })

  it('lays the form out from the schema, so a built form travels with the entity', () => {
    const laidOut: EntitySchema = {
      name: 'people',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'name', type: 'text' },
        { field: 'email', type: 'text' },
        { field: 'street', type: 'text' },
        { field: 'city', type: 'text' },
      ],
      form: {
        columns: 2,
        sections: [
          { title: 'Who', description: 'How we reach them.', fields: ['name', 'email'] },
          { title: 'Where', columns: 1, fields: ['street', 'city'] },
        ],
      },
    }
    const el = render({ schema: laidOut, presentation: 'inline', onSubmit: vi.fn() })

    const titles = [...el.querySelectorAll('.sv-ep__section-title')].map((n) => n.textContent)
    expect(titles).toEqual(['Who', 'Where'])
    expect(el.querySelector('.sv-ep__section-desc')?.textContent).toBe('How we reach them.')

    // Per-section column count wins over the form's.
    const bodies = [...el.querySelectorAll<HTMLElement>('.sv-ep__body')]
    expect(bodies[0]!.style.getPropertyValue('--sv-ep-cols')).toBe('2')
    expect(bodies[1]!.style.getPropertyValue('--sv-ep-cols')).toBe('1')

    // The unassigned id field is not dropped - it lands in a trailing group.
    expect(el.querySelector('#sv-ef-id')).toBeTruthy()
  })

  it('fills its container inline, and carries the size class that narrows it', () => {
    // Inline used to be capped at 460px and ignore formSize entirely, so a form
    // block wider than that drew a narrow form in a wide box.
    const el = render({ schema, presentation: 'inline', onSubmit: vi.fn() })
    const panel = el.querySelector('.sv-ep--inline')!
    expect(panel.classList.contains('sv-ep--sz-md')).toBe(true) // the default
    const narrow = render({ schema, presentation: 'inline', formSize: 'sm', onSubmit: vi.fn() })
    expect(narrow.querySelector('.sv-ep--inline')!.classList.contains('sv-ep--sz-sm')).toBe(true)
  })

  it('folds a section away, and opens it again rather than hiding an error', async () => {
    const long: EntitySchema = {
      name: 'people',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'name', type: 'text' },
        { field: 'vat', type: 'text', required: true },
      ],
      form: {
        sections: [
          { title: 'Who', fields: ['name'] },
          { title: 'Billing', fields: ['vat'], collapsible: true, collapsed: true },
        ],
      },
    }
    const onSubmit = vi.fn()
    const el = render({ schema: long, presentation: 'inline', onSubmit })

    // Folding is a disclosure button, and it starts shut.
    const toggle = el.querySelector<HTMLButtonElement>('.sv-ep__section-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const bodies = [...el.querySelectorAll<HTMLElement>('.sv-ep__body')]
    expect(bodies[1]!.hidden).toBe(true)
    // A shut group says how much is in it rather than looking empty.
    expect(el.querySelector('.sv-ep__section-count')?.textContent).toBe('1')
    // "Who" is not collapsible, so it has no toggle.
    expect(el.querySelectorAll('.sv-ep__section-toggle')).toHaveLength(1)

    toggle.click()
    flushSync()
    expect(el.querySelector<HTMLButtonElement>('.sv-ep__section-toggle')!.getAttribute('aria-expanded')).toBe('true')
    expect([...el.querySelectorAll<HTMLElement>('.sv-ep__body')][1]!.hidden).toBe(false)

    // Fold it back, then submit: `vat` is required, so the section must reopen -
    // a folded group is a display state, not a condition, and its fields are
    // still validated. Pointing at an error nobody can see would be a dead end.
    el.querySelector<HTMLButtonElement>('.sv-ep__section-toggle')!.click()
    flushSync()
    expect([...el.querySelectorAll<HTMLElement>('.sv-ep__body')][1]!.hidden).toBe(true)

    el.querySelector('form')!.requestSubmit()
    await vi.waitFor(() => expect(el.querySelector('.sv-ep-field__err')).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
    expect([...el.querySelectorAll<HTMLElement>('.sv-ep__body')][1]!.hidden).toBe(false)
    expect(el.querySelector('.sv-ep__section-toggle')!.getAttribute('aria-expanded')).toBe('true')
  })

  it('asks one step at a time, and will not let you past a step that is wrong', async () => {
    const wizard: EntitySchema = {
      name: 'people',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'name', type: 'text', required: true },
        { field: 'email', type: 'text' },
        { field: 'vat', type: 'text' },
      ],
      form: {
        steps: true,
        sections: [
          { title: 'Who', fields: ['name'] },
          { title: 'Contact', fields: ['email'] },
          { title: 'Billing', fields: ['vat', 'id'] },
        ],
      },
    }
    const onSubmit = vi.fn()
    const el = render({ schema: wizard, presentation: 'inline', onSubmit })
    const btn = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label)

    // Only the current step is on screen, and the rail names every step.
    expect([...el.querySelectorAll('.sv-ep__step-label')].map((n) => n.textContent)).toEqual(['Who', 'Contact', 'Billing'])
    expect(el.querySelectorAll('.sv-ep__section')).toHaveLength(1)
    expect(el.querySelector('#sv-ef-name')).toBeTruthy()
    expect(el.querySelector('#sv-ef-email')).toBeFalsy()
    // Mid-wizard the primary action is Next, not Save - and there is no Back yet.
    expect(btn('Next')).toBeTruthy()
    expect(btn('Save')).toBeFalsy()
    expect(btn('Back')).toBeFalsy()

    // `name` is required and empty, so Next must refuse and say why.
    btn('Next')!.click()
    await vi.waitFor(() => expect(el.querySelector('.sv-ep-field__err')).toBeTruthy())
    expect(el.querySelector('#sv-ef-email')).toBeFalsy() // still on step 1

    const nameInput = el.querySelector<HTMLInputElement>('#sv-ef-name')!
    nameInput.value = 'Ada'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    btn('Next')!.click()
    await vi.waitFor(() => expect(el.querySelector('#sv-ef-email')).toBeTruthy())
    expect(el.querySelector('#sv-ef-name')).toBeFalsy()
    expect(btn('Back')).toBeTruthy()

    // Back does not re-validate - going backwards is always allowed.
    btn('Back')!.click()
    flushSync()
    expect(el.querySelector('#sv-ef-name')).toBeTruthy()

    btn('Next')!.click()
    await vi.waitFor(() => expect(el.querySelector('#sv-ef-email')).toBeTruthy())
    btn('Next')!.click()
    await vi.waitFor(() => expect(el.querySelector('#sv-ef-vat')).toBeTruthy())
    // Last step: the primary action becomes the real submit.
    expect(btn('Next')).toBeFalsy()
    expect(el.querySelector('button[type="submit"]')).toBeTruthy()
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  it('a single section is a page, not a one-step wizard', () => {
    const one: EntitySchema = {
      name: 'people', idField: 'id',
      fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'name', type: 'text' }],
      form: { steps: true, sections: [{ title: 'Who', fields: ['name'] }] },
    }
    const el = render({ schema: one, presentation: 'inline', onSubmit: vi.fn() })
    expect(el.querySelector('.sv-ep__steps')).toBeFalsy()
    expect(el.querySelector('button[type="submit"]')).toBeTruthy()
  })

  it('waits until you leave a field before complaining, then clears as you fix it', async () => {
    const required: EntitySchema = {
      name: 'people',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'email', type: 'text', required: true, format: 'email' },
      ],
    }
    const el = render({ schema: required, presentation: 'inline', onSubmit: vi.fn() })
    const input = el.querySelector<HTMLInputElement>('#sv-ef-email')!

    // Typing something invalid says nothing yet - the user is mid-thought.
    input.value = 'nope'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(el.querySelector('.sv-ep-field__err')).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBe('false')

    // Leaving it is the moment to speak up.
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await vi.waitFor(() => expect(el.querySelector('.sv-ep-field__err')?.textContent).toMatch(/valid email/))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    // The message is wired to the input for screen readers.
    expect(input.getAttribute('aria-describedby')).toBe('sv-ee-email')
    expect(el.querySelector('#sv-ee-email')).toBeTruthy()

    // Correcting it clears the message without another submit.
    input.value = 'ada@example.com'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.waitFor(() => expect(el.querySelector('.sv-ep-field__err')).toBeNull())
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('summarises a failed submit and focuses the first field that needs fixing', async () => {
    const required: EntitySchema = {
      name: 'people',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'name', type: 'text', required: true },
        { field: 'email', type: 'text', required: true },
      ],
    }
    const onSubmit = vi.fn()
    const el = render({ schema: required, presentation: 'inline', onSubmit })

    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()

    await vi.waitFor(() => expect(el.querySelector('.sv-ep__summary')).toBeTruthy())
    expect(onSubmit).not.toHaveBeenCalled()
    const summary = el.querySelector('.sv-ep__summary')!
    expect(summary.getAttribute('role')).toBe('alert')
    expect(summary.textContent).toContain('Name')
    expect(summary.textContent).toContain('Email')
    // Focus lands on the first problem, so fixing can start immediately.
    expect(document.activeElement?.id).toBe('sv-ef-name')
  })

  it('asks before throwing away edits, and closes straight away when there are none', () => {
    const onCancel = vi.fn()
    const el = render({
      schema,
      row: { id: '1', name: 'Ada', mrr: 1200, active: true, tier: 'pro' },
      presentation: 'inline',
      onSubmit: vi.fn(),
      onCancel,
    })
    const cancel = () => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Cancel')!

    // Untouched: cancelling just closes.
    cancel().click()
    flushSync()
    expect(onCancel).toHaveBeenCalledTimes(1)

    // Now dirty the form; cancelling asks instead of discarding.
    const name = el.querySelector<HTMLInputElement>('#sv-ef-name')!
    name.value = 'Grace'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    cancel().click()
    flushSync()
    expect(onCancel).toHaveBeenCalledTimes(1) // still not closed
    expect(el.textContent).toContain('Discard your changes?')

    // "Keep editing" puts you back in the form with the edit intact.
    ;[...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Keep editing')!.click()
    flushSync()
    expect(el.textContent).not.toContain('Discard your changes?')
    expect(el.querySelector<HTMLInputElement>('#sv-ef-name')!.value).toBe('Grace')

    // Confirming discards.
    cancel().click()
    flushSync()
    ;[...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Discard')!.click()
    flushSync()
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('reveals and locks fields live as the answers change', async () => {
    // One answer drives two others: choosing "refund" asks for a justification
    // and unlocks the approver, both without a remount.
    const cmp = (column: string, op: string, value: unknown) => ({ kind: 'cmp', column, op, value })
    const returns = {
      name: 'returns',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true, readonly: true },
        { field: 'mode', type: 'text' },
        { field: 'justification', type: 'text', label: 'Justification', when: { visible: cmp('mode', 'equals', 'refund') } },
        { field: 'approver', type: 'text', when: { disabled: cmp('mode', 'notEquals', 'refund') } },
      ],
    } as unknown as EntitySchema<Record<string, unknown>>

    const el = render({
      schema: returns,
      row: { id: '1', mode: 'exchange', justification: '', approver: '' },
      presentation: 'inline',
      onSubmit: vi.fn(),
    })

    // An exchange: no justification asked for, and the approver is locked.
    expect(el.textContent).not.toContain('Justification')
    expect(el.querySelector('#sv-ef-approver')!.hasAttribute('disabled')).toBe(true)

    // Switch to a refund; both fields react to the new value.
    const mode = el.querySelector<HTMLInputElement>('#sv-ef-mode')!
    mode.value = 'refund'
    mode.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()

    expect(el.textContent).toContain('Justification')
    expect(el.querySelector('#sv-ef-approver')!.hasAttribute('disabled')).toBe(false)
  })
})
