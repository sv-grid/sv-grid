<script lang="ts" module>
  export type FormFieldType =
    | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'password'
    | 'select' | 'checkbox' | 'switch' | 'date' | 'color' | 'rating'

  export type FormField = {
    name: string
    label: string
    type?: FormFieldType
    required?: boolean
    placeholder?: string
    options?: Array<{ value: string | number; label: string }>
    /** Return an error message, or null/undefined when valid. */
    validate?: (value: any, values: Record<string, any>) => string | null | undefined
    /** Span full width in the grid. */
    full?: boolean
  }
</script>

<script lang="ts">
  /**
   * SvForm - a schema-driven form that renders the SvGrid UI-kit controls with
   * labels, required + custom validation, and a submit handler. Parity: Smart
   * `smart-form`. Emits `onSubmit(values)` only when valid; `onChange` on edits.
   */
  import SvNumberInput from './SvNumberInput.svelte'
  import SvPasswordInput from './SvPasswordInput.svelte'
  import SvDropDownList from './SvDropDownList.svelte'
  import SvCheckBox from './SvCheckBox.svelte'
  import SvSwitchButton from './SvSwitchButton.svelte'
  import SvDateTimePicker from './SvDateTimePicker.svelte'
  import SvColorInput from './SvColorInput.svelte'
  import SvRating from './SvRating.svelte'
  import SvButton from './SvButton.svelte'

  type Props = {
    fields: ReadonlyArray<FormField>
    initial?: Record<string, any>
    onSubmit?: (values: Record<string, any>) => void
    onChange?: (values: Record<string, any>) => void
    submitLabel?: string
    /** Columns in the responsive field grid. */
    columns?: number
    disabled?: boolean
  }

  let { fields, initial = {}, onSubmit, onChange, submitLabel = 'Submit', columns = 1, disabled = false }: Props = $props()

  let values = $state<Record<string, any>>({})
  let errors = $state<Record<string, string>>({})
  let touched = $state<Record<string, boolean>>({})
  let seededForm = false
  $effect(() => { if (!seededForm) { seededForm = true; values = { ...initial } } })

  function setValue(name: string, v: any) {
    values = { ...values, [name]: v }
    onChange?.(values)
    if (touched[name]) validateField(name)
  }

  function validateField(name: string): boolean {
    const field = fields.find((f) => f.name === name)
    if (!field) return true
    const v = values[name]
    let err: string | null | undefined = null
    if (field.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) err = `${field.label} is required`
    else if (field.validate) err = field.validate(v, values)
    const next = { ...errors }
    if (err) next[name] = err
    else delete next[name]
    errors = next
    return !err
  }

  function submit(e: Event) {
    e.preventDefault()
    let ok = true
    const t: Record<string, boolean> = {}
    for (const f of fields) { t[f.name] = true; if (!validateField(f.name)) ok = false }
    touched = t
    if (ok) onSubmit?.({ ...values })
  }

  const dateVal = (v: any): Date | null => (v instanceof Date ? v : v ? new Date(v) : null)
</script>

<form class="sv-form" style:--cols={columns} onsubmit={submit} novalidate>
  <div class="sv-form__grid">
    {#each fields as field (field.name)}
      {@const type = field.type ?? 'text'}
      <div class="sv-form__field" class:is-full={field.full || columns === 1} class:has-error={errors[field.name]}>
        {#if type !== 'checkbox' && type !== 'switch'}
          <label class="sv-form__label" for={`f-${field.name}`}>
            {field.label}{#if field.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}
          </label>
        {/if}

        {#if type === 'textarea'}
          <textarea id={`f-${field.name}`} class="sv-form__control sv-form__textarea" rows="3" {disabled} placeholder={field.placeholder} value={values[field.name] ?? ''} oninput={(e) => setValue(field.name, e.currentTarget.value)} onblur={() => { touched[field.name] = true; validateField(field.name) }}></textarea>
        {:else if type === 'number'}
          <SvNumberInput value={values[field.name] ?? null} {disabled} onChange={(v) => setValue(field.name, v)} />
        {:else if type === 'password'}
          <SvPasswordInput value={values[field.name] ?? ''} {disabled} onChange={(v) => setValue(field.name, v)} />
        {:else if type === 'select'}
          <SvDropDownList options={field.options ?? []} value={values[field.name] ?? null} {disabled} placeholder={field.placeholder} onChange={(v) => setValue(field.name, v)} />
        {:else if type === 'checkbox'}
          <SvCheckBox checked={!!values[field.name]} {disabled} onChange={(v) => setValue(field.name, v)}>{field.label}</SvCheckBox>
        {:else if type === 'switch'}
          <div class="sv-form__inline"><SvSwitchButton checked={!!values[field.name]} {disabled} onChange={(v) => setValue(field.name, v)} ariaLabel={field.label} /><span>{field.label}</span></div>
        {:else if type === 'date'}
          <SvDateTimePicker value={dateVal(values[field.name])} dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" {disabled} onChange={(v) => setValue(field.name, v)} />
        {:else if type === 'color'}
          <SvColorInput value={values[field.name] ?? '#3b82f6'} {disabled} onChange={(v) => setValue(field.name, v)} />
        {:else if type === 'rating'}
          <SvRating value={values[field.name] ?? 0} {disabled} onChange={(v) => setValue(field.name, v)} />
        {:else}
          <input id={`f-${field.name}`} class="sv-form__control" type={type} {disabled} placeholder={field.placeholder} value={values[field.name] ?? ''} oninput={(e) => setValue(field.name, e.currentTarget.value)} onblur={() => { touched[field.name] = true; validateField(field.name) }} />
        {/if}

        {#if errors[field.name]}<span class="sv-form__error" role="alert">{errors[field.name]}</span>{/if}
      </div>
    {/each}
  </div>
  <div class="sv-form__actions">
    <SvButton type="submit" {disabled}>{submitLabel}</SvButton>
  </div>
</form>

<style>
  .sv-form { --_accent: var(--sg-accent, #2563eb); width: 100%; }
  .sv-form__grid { display: grid; grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr)); gap: 14px 18px; }
  .sv-form__field { display: flex; flex-direction: column; gap: 5px; }
  .sv-form__field.is-full { grid-column: 1 / -1; }
  .sv-form__label { font-size: 12.5px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sv-form__req { color: var(--sg-danger, #dc2626); }
  .sv-form__control {
    width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; font: inherit; font-size: 13px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px); outline: none;
  }
  .sv-form__textarea { height: auto; padding: 8px 10px; resize: vertical; }
  .sv-form__control:focus { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-form__field.has-error .sv-form__control { border-color: var(--sg-danger, #dc2626); }
  .sv-form__inline { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .sv-form__error { font-size: 11.5px; color: var(--sg-danger, #dc2626); }
  .sv-form__actions { margin-top: 16px; }
</style>
