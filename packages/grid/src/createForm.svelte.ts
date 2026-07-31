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
import type { FormField } from './form-field'
import { runRules } from './validators'

export type FormConfig = {
  fields: () => ReadonlyArray<FormField>
  /** Seed values on creation. */
  initial?: Record<string, any>
  onSubmit?: (values: Record<string, any>) => void
  onChange?: (values: Record<string, any>) => void
}

export function createForm(config: FormConfig) {
  let values = $state<Record<string, any>>({ ...(config.initial ?? {}) })
  let errors = $state<Record<string, string>>({})
  let touched = $state<Record<string, boolean>>({})

  function validateField(name: string): boolean {
    const field = config.fields().find((f) => f.name === name)
    if (!field) return true
    const v = values[name]
    let err: string | null | undefined = null
    if (field.required && (v == null || v === '' || (Array.isArray(v) && !v.length)))
      err = `${field.label} is required`
    if (!err && field.rules) err = runRules(v, field.rules, values)
    if (!err && field.validate) err = field.validate(v, values)
    const next = { ...errors }
    if (err) next[name] = err
    else delete next[name]
    errors = next
    return !err
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

  function submit(): boolean {
    let ok = true
    const t: Record<string, boolean> = {}
    for (const f of config.fields()) {
      t[f.name] = true
      if (!validateField(f.name)) ok = false
    }
    touched = t
    if (ok) config.onSubmit?.({ ...values })
    return ok
  }

  return {
    get values() { return values },
    value: (name: string) => values[name],
    error: (name: string): string | undefined => errors[name],
    isTouched: (name: string) => !!touched[name],
    hasError: (name: string) => !!errors[name],
    setValue,
    handleBlur,
    validateField,
    submit,
  }
}

export type Form = ReturnType<typeof createForm>
