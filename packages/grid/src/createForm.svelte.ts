/**
 * createForm - the HEADLESS core behind <SvForm>: values / errors / touched
 * state, required + rule + custom validation (validate-on-blur-then-live), and a
 * submit that validates every field first. No markup, no controls - you render
 * the fields however you like and read/write through the core.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createForm } from '@svgrid/grid'
 *   const form = createForm({ fields: () => fields, onSubmit: (v) => save(v) })
 * </script>
 * <form onsubmit={(e) => { e.preventDefault(); form.submit() }}>
 *   {#each fields as f}
 *     <input value={form.value(f.name) ?? ''}
 *       oninput={(e) => form.setValue(f.name, e.currentTarget.value)}
 *       onblur={() => form.handleBlur(f.name)} />
 *     {#if form.error(f.name)}<span>{form.error(f.name)}</span>{/if}
 *   {/each}
 * </form>
 * ```
 */
import { flattenFields, type FormField, type FormEntry } from './form-field'
import { runRules } from './validators'

export type FormConfig = {
  /** The schema - a mix of flat fields and titled sections. */
  fields: () => ReadonlyArray<FormEntry>
  /** Seed values on creation. */
  initial?: Record<string, any>
  /** Called with the (visible-field) values on a valid submit. May be async;
   *  `submitting` stays true until the returned promise settles. */
  onSubmit?: (values: Record<string, any>) => void | Promise<void>
  onChange?: (values: Record<string, any>) => void
}

/** Deep-ish equality for dirty tracking: identity for primitives, structural
 *  (JSON) for arrays/objects. Good enough for form values. */
function eq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
  }
  return false
}

/** Resolve a `boolean | (values) => boolean` field flag. */
function resolveFlag(
  flag: boolean | ((values: Record<string, any>) => boolean) | undefined,
  dflt: boolean,
  values: Record<string, any>,
): boolean {
  if (flag == null) return dflt
  return typeof flag === 'function' ? !!flag(values) : !!flag
}

export function createForm(config: FormConfig) {
  let values = $state<Record<string, any>>({ ...(config.initial ?? {}) })
  let errors = $state<Record<string, string>>({})
  let touched = $state<Record<string, boolean>>({})
  let submitting = $state(false)
  let validating = $state<Record<string, boolean>>({})
  // Baseline for dirty tracking + reset. Rebased when `reset(next)` is passed.
  let baseline = { ...(config.initial ?? {}) }
  // Async-validation bookkeeping: debounce timers + a per-field run sequence so
  // only the latest response wins (stale responses are dropped).
  const asyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const asyncSeq = new Map<string, number>()

  // The flat field list (sections flattened) drives all values/validation.
  const flat = () => flattenFields(config.fields())
  const fieldOf = (name: string) => flat().find((f) => f.name === name)
  const isVisible = (name: string) => resolveFlag(fieldOf(name)?.visible, true, values)
  const isDisabled = (name: string) => resolveFlag(fieldOf(name)?.disabled, false, values)

  function setError(name: string, err: string | null | undefined) {
    const next = { ...errors }
    if (err) next[name] = err
    else delete next[name]
    errors = next
  }

  /** The synchronous checks: required, then declarative rules, then a sync
   *  `validate`. Returns the first error message, or null. `ctx` is the values
   *  object rules/validate see - the form values, or a single item for array
   *  rows (so within-row cross-field rules work). */
  function syncError(field: FormField, v: any, ctx: Record<string, any> = values): string | null {
    if (field.required && (v == null || v === '' || (Array.isArray(v) && !v.length)))
      return `${field.label} is required`
    if (field.rules) { const e = runRules(v, field.rules, ctx); if (e) return e }
    if (field.validate) { const e = field.validate(v, ctx); if (e) return e }
    return null
  }

  function cancelAsync(name: string) {
    const t = asyncTimers.get(name)
    if (t) { clearTimeout(t); asyncTimers.delete(name) }
    // Bump the sequence so any in-flight response is treated as stale.
    asyncSeq.set(name, (asyncSeq.get(name) ?? 0) + 1)
    if (validating[name]) validating = { ...validating, [name]: false }
  }

  /** Run a field's async validator now (guarded against stale responses). */
  async function runAsync(name: string): Promise<boolean> {
    const field = fieldOf(name)
    if (!field?.asyncValidate || !isVisible(name)) return true
    if (syncError(field, values[name])) return false // sync error already shown
    const seq = (asyncSeq.get(name) ?? 0) + 1
    asyncSeq.set(name, seq)
    validating = { ...validating, [name]: true }
    try {
      const err = await field.asyncValidate(values[name], values)
      if (asyncSeq.get(name) !== seq) return true // superseded - ignore
      setError(name, err ?? null)
      return !err
    } finally {
      if (asyncSeq.get(name) === seq) validating = { ...validating, [name]: false }
    }
  }

  function scheduleAsync(name: string) {
    const field = fieldOf(name)
    if (!field?.asyncValidate) return
    const prev = asyncTimers.get(name)
    if (prev) clearTimeout(prev)
    asyncTimers.set(name, setTimeout(() => { asyncTimers.delete(name); runAsync(name) }, field.asyncDebounce ?? 300))
  }

  function validateField(name: string): boolean {
    const field = fieldOf(name)
    if (!field) return true
    // Hidden fields never block submit; clear any stale error + pending check.
    if (!isVisible(name)) { setError(name, null); cancelAsync(name); return true }
    if (field.type === 'array') return validateArray(field)
    const err = syncError(field, values[name])
    setError(name, err)
    if (err) { cancelAsync(name); return false }
    // Sync passed - kick off the debounced async check if there is one.
    if (field.asyncValidate) scheduleAsync(name)
    return true
  }

  // --- Field arrays (repeatable groups) -----------------------------------
  const arrayItems = (name: string): Record<string, any>[] =>
    Array.isArray(values[name]) ? values[name] : []
  const itemValue = (name: string, i: number, field: string) => arrayItems(name)[i]?.[field]
  const itemError = (name: string, i: number, field: string) => errors[`${name}.${i}.${field}`]

  function clearNamespacedErrors(name: string) {
    const prefix = `${name}.`
    const next = { ...errors }
    let changed = false
    for (const k of Object.keys(next)) if (k.startsWith(prefix)) { delete next[k]; changed = true }
    if (changed) errors = next
  }

  function setItems(name: string, next: Record<string, any>[]) {
    values = { ...values, [name]: next }
    config.onChange?.(values)
  }

  function addItem(name: string, item?: Record<string, any>) {
    const seed = item ?? Object.fromEntries((fieldOf(name)?.itemFields ?? []).map((f) => [f.name, undefined]))
    setItems(name, [...arrayItems(name), seed])
  }
  function removeItem(name: string, i: number) {
    const items = arrayItems(name).slice()
    items.splice(i, 1)
    clearNamespacedErrors(name) // item indices shift - drop stale keys
    setItems(name, items)
  }
  function moveItem(name: string, from: number, to: number) {
    const items = arrayItems(name).slice()
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return
    const [it] = items.splice(from, 1)
    items.splice(to, 0, it as Record<string, any>)
    clearNamespacedErrors(name)
    setItems(name, items)
  }
  function setItemValue(name: string, i: number, field: string, v: any) {
    setItems(name, arrayItems(name).map((it, ix) => (ix === i ? { ...it, [field]: v } : it)))
    if (touched[`${name}.${i}.${field}`]) validateItemField(name, i, field)
  }
  function handleItemBlur(name: string, i: number, field: string) {
    touched = { ...touched, [`${name}.${i}.${field}`]: true }
    validateItemField(name, i, field)
  }
  function validateItemField(name: string, i: number, fieldName: string): boolean {
    const itemField = fieldOf(name)?.itemFields?.find((f) => f.name === fieldName)
    if (!itemField) return true
    const item = arrayItems(name)[i] ?? {}
    const err = syncError(itemField, item[fieldName], item)
    setError(`${name}.${i}.${fieldName}`, err)
    return !err
  }
  function validateArray(field: FormField): boolean {
    const name = field.name
    const items = arrayItems(name)
    let arrErr: string | null = null
    if (field.required && items.length === 0) arrErr = `${field.label} is required`
    else if (field.minItems != null && items.length < field.minItems) arrErr = `Add at least ${field.minItems} item(s)`
    else if (field.maxItems != null && items.length > field.maxItems) arrErr = `At most ${field.maxItems} item(s)`
    setError(name, arrErr)
    let ok = !arrErr
    clearNamespacedErrors(name) // rebuild fresh per-item errors
    for (let i = 0; i < items.length; i++)
      for (const itf of field.itemFields ?? [])
        if (!validateItemField(name, i, itf.name)) ok = false
    return ok
  }

  function setValue(name: string, v: any) {
    values = { ...values, [name]: v }
    config.onChange?.(values)
    // Re-validate live once the field has been blurred at least once.
    if (touched[name]) validateField(name)
  }

  function handleBlur(name: string) {
    touched = { ...touched, [name]: true }
    validateField(name)
  }

  async function submit(): Promise<boolean> {
    let ok = true
    const t: Record<string, boolean> = { ...touched }
    for (const f of flat()) {
      if (!isVisible(f.name)) continue
      t[f.name] = true
      if (!validateField(f.name)) ok = false
    }
    touched = t
    if (!ok) return false
    // Await async validators (run now, skipping their debounce). Any failure blocks.
    const asyncFields = flat().filter((f) => f.asyncValidate && isVisible(f.name))
    if (asyncFields.length) {
      for (const f of asyncFields) { const timer = asyncTimers.get(f.name); if (timer) { clearTimeout(timer); asyncTimers.delete(f.name) } }
      const results = await Promise.all(asyncFields.map((f) => runAsync(f.name)))
      if (results.some((r) => !r)) return false
    }
    // Exclude hidden fields from the submitted payload; keep any non-field keys.
    const payload = { ...values }
    for (const f of flat()) if (!isVisible(f.name)) delete payload[f.name]
    submitting = true
    try {
      await config.onSubmit?.(payload)
    } finally {
      submitting = false
    }
    return true
  }

  /** Validate a subset of fields by name (sync + their async validators). Used
   *  to gate a wizard step before advancing. Returns true when all pass. */
  async function validateFields(names: string[]): Promise<boolean> {
    let ok = true
    const t = { ...touched }
    for (const name of names) {
      if (!isVisible(name)) continue
      t[name] = true
      if (!validateField(name)) ok = false
    }
    touched = t
    if (!ok) return false
    const asyncNames = names.filter((n) => fieldOf(n)?.asyncValidate && isVisible(n))
    if (asyncNames.length) {
      for (const n of asyncNames) { const timer = asyncTimers.get(n); if (timer) { clearTimeout(timer); asyncTimers.delete(n) } }
      const results = await Promise.all(asyncNames.map((n) => runAsync(n)))
      if (results.some((r) => !r)) return false
    }
    return true
  }

  /** Restore values to the baseline (or a new one), clearing errors + touched. */
  function reset(next?: Record<string, any>) {
    if (next) baseline = { ...next }
    values = { ...baseline }
    errors = {}
    touched = {}
    config.onChange?.(values)
  }

  /** Inject errors (e.g. server-side validation after submit) and mark those
   *  fields touched so the messages show. Empty message clears a field's error. */
  function setErrors(map: Record<string, string>) {
    const nextErr = { ...errors }
    const nextTouched = { ...touched }
    for (const [k, msg] of Object.entries(map)) {
      if (msg) { nextErr[k] = msg; nextTouched[k] = true }
      else delete nextErr[k]
    }
    errors = nextErr
    touched = nextTouched
  }

  const isFieldDirty = (name: string) => !eq(values[name], baseline[name])

  return {
    get values() { return values },
    get submitting() { return submitting },
    get isDirty() {
      const keys = new Set([...Object.keys(values), ...Object.keys(baseline)])
      for (const k of keys) if (!eq(values[k], baseline[k])) return true
      return false
    },
    value: (name: string) => values[name],
    error: (name: string): string | undefined => errors[name],
    isTouched: (name: string) => !!touched[name],
    hasError: (name: string) => !!errors[name],
    isValidating: (name: string) => !!validating[name],
    isFieldDirty,
    isVisible,
    isDisabled,
    entries: () => config.fields(),
    // Field arrays
    arrayItems,
    itemValue,
    itemError,
    addItem,
    removeItem,
    moveItem,
    setItemValue,
    handleItemBlur,
    setValue,
    handleBlur,
    validateField,
    validateFields,
    submit,
    reset,
    setErrors,
  }
}

export type Form = ReturnType<typeof createForm>
