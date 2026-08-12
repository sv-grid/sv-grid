/**
 * Component tests for SvForm, exercising the shared createForm core: required +
 * custom validation block submit and surface errors, a valid form submits its
 * values, and onChange fires on edits.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvForm from './SvForm.svelte'

function mountForm(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvForm, { target, props: props as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const submitForm = (target: HTMLElement) => {
  target.querySelector('form.sv-form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  flushSync()
}
const setInput = (target: HTMLElement, id: string, value: string) => {
  const el = target.querySelector<HTMLInputElement>(`#${id}`)!
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  flushSync()
}
const tick = async () => { await new Promise((r) => setTimeout(r)); flushSync() }
const byText = (target: HTMLElement, text: string) =>
  [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'email', label: 'Email', type: 'email' as const,
    validate: (v: any) => (v && !String(v).includes('@') ? 'Invalid email' : null) },
]

describe('SvForm', () => {
  it('blocks submit and shows an error when a required field is empty', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      submitForm(target)
      expect(onSubmit).not.toHaveBeenCalled()
      const err = target.querySelector('.sv-form__error[role="alert"]')
      expect(err?.textContent).toContain('Name is required')
    } finally { destroy() }
  })

  it('submits the collected values when valid', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      setInput(target, 'f-name', 'Ada')
      submitForm(target)
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ name: 'Ada' })
    } finally { destroy() }
  })

  it('runs a custom validator', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields, onSubmit })
    try {
      setInput(target, 'f-name', 'Ada')
      setInput(target, 'f-email', 'nope')
      submitForm(target)
      expect(onSubmit).not.toHaveBeenCalled()
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('Invalid email'))).toBe(true)
    } finally { destroy() }
  })

  it('fires onChange as fields are edited', () => {
    const onChange = vi.fn()
    const { target, destroy } = mountForm({ fields, onChange })
    try {
      setInput(target, 'f-name', 'A')
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ name: 'A' })
    } finally { destroy() }
  })

  it('renders an error summary after a failed submit', () => {
    const { target, destroy } = mountForm({ fields, errorSummary: true })
    try {
      submitForm(target)
      const summary = target.querySelector('.sv-form__summary[role="alert"]')
      expect(summary).not.toBeNull()
      const links = target.querySelectorAll('.sv-form__summary-link')
      expect(links.length).toBeGreaterThan(0)
      expect(links[0]!.textContent).toContain('is required')
    } finally { destroy() }
  })

  it('applies serverErrors reactively', () => {
    const { target, destroy } = mountForm({ fields, serverErrors: { name: 'Name already taken' } })
    try {
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('already taken'))).toBe(true)
    } finally { destroy() }
  })

  it('overrides the built-in required message and links the error via aria-describedby', () => {
    const { target, destroy } = mountForm({ fields, messages: { required: (l: string) => `${l} manquant` } })
    try {
      submitForm(target)
      const err = target.querySelector('#f-name__error')
      expect(err?.textContent).toBe('Name manquant')
      // aria wiring: the input points at the error id
      expect(target.querySelector('#f-name')?.getAttribute('aria-describedby')).toBe('f-name__error')
      expect(target.querySelector('#f-name')?.getAttribute('aria-invalid')).toBe('true')
    } finally { destroy() }
  })

  it('mirrors dir onto the form element', () => {
    const { target, destroy } = mountForm({ fields, dir: 'rtl' })
    try {
      expect(target.querySelector('form.sv-form')?.getAttribute('dir')).toBe('rtl')
    } finally { destroy() }
  })

  it('computed fields derive their value, render read-only, and are in the payload', async () => {
    const onSubmit = vi.fn()
    const cf = [
      { name: 'qty', label: 'Qty', type: 'number' as const },
      { name: 'price', label: 'Price', type: 'number' as const },
      { name: 'total', label: 'Total', type: 'text' as const, computed: (v: any) => (v.qty ?? 0) * (v.price ?? 0) },
    ]
    const { target, destroy } = mountForm({ fields: cf, initial: { qty: 3, price: 4 }, onSubmit })
    try {
      const totalInput = target.querySelector<HTMLInputElement>('#f-total')!
      expect(totalInput.value).toBe('12')     // derived
      expect(totalInput.readOnly).toBe(true)  // read-only
      submitForm(target); await tick()
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0].total).toBe(12) // computed value in payload
    } finally { destroy() }
  })

  it('cascading: changing a parent clears fields that dependOn it (onChange payload)', () => {
    const onChange = vi.fn()
    const cf = [
      { name: 'country', label: 'Country', options: [{ value: 'us', label: 'US' }, { value: 'ca', label: 'CA' }] },
      { name: 'state', label: 'State', dependsOn: 'country', options: (v: any) => (v.country === 'us' ? [{ value: 'ny', label: 'NY' }] : []) },
    ]
    // country + state are plain text inputs here (default type) so we can drive them via the DOM.
    const { target, destroy } = mountForm({ fields: cf, initial: { country: 'us', state: 'ny' }, onChange })
    try {
      setInput(target, 'f-country', 'ca')
      // The last onChange payload has the parent updated AND the child cleared.
      const last = onChange.mock.calls.at(-1)![0]
      expect(last.country).toBe('ca')
      expect(last.state).toBeNull()
    } finally { destroy() }
  })
})

describe('SvForm - conditional fields', () => {
  const flds = [
    { name: 'kind', label: 'Kind' },
    { name: 'other', label: 'Other', required: true, visible: (v: any) => v.kind === 'x' },
  ]

  it('hides a field until its condition is met, and excludes hidden fields from validation + submit', () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields: flds, initial: { kind: '' }, onSubmit })
    try {
      // 'other' is hidden -> not rendered
      expect(target.querySelector('#f-other')).toBeNull()
      // ...and its `required` does not block submit; it's absent from the payload
      setInput(target, 'f-kind', 'y')
      submitForm(target)
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('other')
      // Meeting the condition reveals the field
      setInput(target, 'f-kind', 'x')
      expect(target.querySelector('#f-other')).not.toBeNull()
      // Now visible + required + empty -> blocks submit
      onSubmit.mockClear()
      submitForm(target)
      expect(onSubmit).not.toHaveBeenCalled()
    } finally { destroy() }
  })

  it('derives a field disabled state from other values', () => {
    const dflds = [
      { name: 'lock', label: 'Lock', type: 'switch' as const },
      { name: 'note', label: 'Note', disabled: (v: any) => !!v.lock },
    ]
    const { target, destroy } = mountForm({ fields: dflds, initial: { lock: true } })
    try {
      expect(target.querySelector<HTMLInputElement>('#f-note')!.disabled).toBe(true)
    } finally { destroy() }
  })
})

describe('SvForm - reset + async submit', () => {
  it('reset restores the initial values', () => {
    const { target, destroy } = mountForm({ fields: [{ name: 'name', label: 'Name' }], initial: { name: 'Ada' }, showReset: true })
    try {
      setInput(target, 'f-name', 'Grace')
      expect(target.querySelector<HTMLInputElement>('#f-name')!.value).toBe('Grace')
      const reset = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reset')!
      reset.click(); flushSync()
      expect(target.querySelector<HTMLInputElement>('#f-name')!.value).toBe('Ada')
    } finally { destroy() }
  })

  it('disables the submit button while an async onSubmit is in flight', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    const onSubmit = vi.fn(() => gate)
    const { target, destroy } = mountForm({ fields: [{ name: 'name', label: 'Name' }], initial: { name: 'Ada' }, onSubmit })
    try {
      submitForm(target)
      const btn = target.querySelector<HTMLButtonElement>('button[type="submit"]')!
      expect(btn.disabled).toBe(true) // submitting
      release()
      await gate; await Promise.resolve(); await Promise.resolve(); flushSync()
      expect(btn.disabled).toBe(false)
    } finally { destroy() }
  })
})

describe('SvForm - async validation', () => {
  const flush = async () => { await new Promise((r) => setTimeout(r)); flushSync() }

  it('async validator blocks submit on error and passes once it clears', async () => {
    const onSubmit = vi.fn()
    const check = vi.fn(async (v: string) => (v === 'taken' ? 'Already taken' : null))
    const flds = [{ name: 'user', label: 'User', asyncValidate: check, asyncDebounce: 0 }]
    const { target, destroy } = mountForm({ fields: flds, initial: { user: 'taken' }, onSubmit })
    try {
      submitForm(target)
      await flush()
      expect(onSubmit).not.toHaveBeenCalled()
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('Already taken'))).toBe(true)
      setInput(target, 'f-user', 'free')
      submitForm(target)
      await flush()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    } finally { destroy() }
  })

  it('shows a checking indicator while an async validator runs, then clears', async () => {
    let resolve: (m: string | null) => void = () => {}
    const check = () => new Promise<string | null>((r) => { resolve = r })
    const flds = [{ name: 'user', label: 'User', asyncValidate: check, asyncDebounce: 0 }]
    const { target, destroy } = mountForm({ fields: flds, initial: { user: 'x' } })
    try {
      target.querySelector('#f-user')!.dispatchEvent(new Event('blur', { bubbles: true }))
      flushSync()
      await flush() // debounce timer fires -> runAsync -> validating
      expect(target.querySelector('.sv-form__checking')).not.toBeNull()
      resolve(null)
      await flush()
      expect(target.querySelector('.sv-form__checking')).toBeNull()
    } finally { destroy() }
  })

  it('drops a stale async response (only the latest wins)', async () => {
    const resolvers: Array<(m: string | null) => void> = []
    const check = () => new Promise<string | null>((r) => resolvers.push(r))
    const flds = [{ name: 'user', label: 'User', asyncValidate: check, asyncDebounce: 0 }]
    const { target, destroy } = mountForm({ fields: flds, initial: { user: '' } })
    try {
      target.querySelector('#f-user')!.dispatchEvent(new Event('blur', { bubbles: true }))
      flushSync()
      setInput(target, 'f-user', 'a')
      await flush() // run #1 (resolvers[0])
      setInput(target, 'f-user', 'ab')
      await flush() // run #2 (resolvers[1])
      resolvers[1]?.(null)        // latest resolves clean
      resolvers[0]?.('stale err') // earlier resolves with an error - must be ignored
      await flush()
      expect(target.querySelectorAll('.sv-form__error').length).toBe(0)
    } finally { destroy() }
  })
})

describe('SvForm - sections', () => {
  const schema = [
    { section: 'Account', fields: [{ name: 'user', label: 'User', required: true }] },
    { section: 'Profile', description: 'About you', fields: [{ name: 'bio', label: 'Bio', type: 'textarea' as const }] },
  ]

  it('renders sections as fieldsets with legends, showing all fields', () => {
    const { target, destroy } = mountForm({ fields: schema })
    try {
      expect(target.querySelectorAll('fieldset.sv-form__section').length).toBe(2)
      expect([...target.querySelectorAll('legend')].map((l) => l.textContent?.trim())).toEqual(['Account', 'Profile'])
      expect(target.querySelector('#f-user')).not.toBeNull()
      expect(target.querySelector('#f-bio')).not.toBeNull()
    } finally { destroy() }
  })
})

describe('SvForm - stepper wizard', () => {
  const schema = [
    { section: 'Step 1', fields: [{ name: 'user', label: 'User', required: true }] },
    { section: 'Step 2', fields: [{ name: 'bio', label: 'Bio' }] },
  ]

  it('shows one step, gates Next on validation, reveals Submit on the last step', async () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields: schema, stepper: true, onSubmit })
    try {
      // Only step 1 is rendered
      expect(target.querySelector('#f-user')).not.toBeNull()
      expect(target.querySelector('#f-bio')).toBeNull()
      // Next is blocked while the required field is empty
      byText(target, 'Next').click(); await tick()
      expect(target.querySelector('#f-bio')).toBeNull()
      expect(target.querySelector('.sv-form__error')?.textContent).toContain('User is required')
      // Fill and advance
      setInput(target, 'f-user', 'ada')
      byText(target, 'Next').click(); await tick()
      expect(target.querySelector('#f-bio')).not.toBeNull()
      expect(target.querySelector('#f-user')).toBeNull()
      // Last step: Submit is present and fires
      expect(target.querySelector('button[type="submit"]')).not.toBeNull()
      submitForm(target); await tick()
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ user: 'ada' })
    } finally { destroy() }
  })
})

describe('SvForm - tabs layout', () => {
  const schema = [
    { section: 'Profile', fields: [{ name: 'user', label: 'User', required: true }] },
    { section: 'Bio', fields: [{ name: 'bio', label: 'Bio' }] },
  ]

  it('renders sections as tabs, one panel at a time; failed submit jumps to the erroring tab', async () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields: schema, tabs: true, onSubmit })
    try {
      const tabEls = target.querySelectorAll('[role="tab"]')
      expect(tabEls.length).toBe(2)
      // First tab active -> only its field is in the DOM
      expect(target.querySelector('#f-user')).not.toBeNull()
      expect(target.querySelector('#f-bio')).toBeNull()
      // Switch to the Bio tab
      ;[...target.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.includes('Bio'))!.click()
      flushSync()
      expect(target.querySelector('#f-bio')).not.toBeNull()
      // Submit with the required User empty -> blocked and jumps back to Profile
      submitForm(target); await tick()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(target.querySelector('#f-user')).not.toBeNull() // Profile tab is active again
    } finally { destroy() }
  })
})

describe('SvForm - field arrays', () => {
  const schema = [
    { name: 'contacts', label: 'Contacts', type: 'array' as const, required: true, itemFields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'email', label: 'Email', type: 'email' as const },
    ] },
  ]

  it('adds and removes item rows', () => {
    const { target, destroy } = mountForm({ fields: schema, initial: { contacts: [] } })
    try {
      expect(target.querySelectorAll('.sv-form__arow').length).toBe(0)
      byText(target, '+ Add').click(); flushSync()
      expect(target.querySelectorAll('.sv-form__arow').length).toBe(1)
      expect(target.querySelector('#f-contacts-0-name')).not.toBeNull()
      byText(target, '+ Add').click(); flushSync()
      expect(target.querySelectorAll('.sv-form__arow').length).toBe(2)
      ;(target.querySelectorAll<HTMLButtonElement>('.sv-form__aremove')[0]!).click(); flushSync()
      expect(target.querySelectorAll('.sv-form__arow').length).toBe(1)
    } finally { destroy() }
  })

  it('validates item fields and includes the array in the submitted payload', async () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields: schema, initial: { contacts: [{ name: '', email: '' }] }, onSubmit })
    try {
      submitForm(target); await tick()
      expect(onSubmit).not.toHaveBeenCalled()
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('Name is required'))).toBe(true)
      setInput(target, 'f-contacts-0-name', 'Ada')
      submitForm(target); await tick()
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit.mock.calls[0]![0].contacts).toEqual([{ name: 'Ada', email: '' }])
    } finally { destroy() }
  })

  it('array `required` blocks submit when empty', async () => {
    const onSubmit = vi.fn()
    const { target, destroy } = mountForm({ fields: schema, initial: { contacts: [] }, onSubmit })
    try {
      submitForm(target); await tick()
      expect(onSubmit).not.toHaveBeenCalled()
      expect([...target.querySelectorAll('.sv-form__error')].some((e) => e.textContent?.includes('Contacts is required'))).toBe(true)
    } finally { destroy() }
  })

  it('reorder buttons move an item up/down', () => {
    const { target, destroy } = mountForm({ fields: schema, initial: { contacts: [{ name: 'A', email: '' }, { name: 'B', email: '' }] } })
    try {
      const nameVals = () => [...target.querySelectorAll<HTMLInputElement>('.sv-form__array [id$="-name"]')].map((i) => i.value)
      expect(nameVals()).toEqual(['A', 'B'])
      ;(target.querySelectorAll<HTMLButtonElement>('button[aria-label="Move down"]')[0]!).click(); flushSync()
      expect(nameVals()).toEqual(['B', 'A'])
      ;(target.querySelectorAll<HTMLButtonElement>('button[aria-label="Move up"]')[1]!).click(); flushSync()
      expect(nameVals()).toEqual(['A', 'B'])
    } finally { destroy() }
  })
})
