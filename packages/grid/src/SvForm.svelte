<script lang="ts" module>
  // FormField/FormFieldType live in a plain `.ts` (breaks a Vite dev import
  // cycle); re-exported so `import { type FormField } from './SvForm.svelte'`
  // sites keep working.
  export type { FormField, FormFieldType, FormSection, FormEntry } from './form-field'
</script>

<script lang="ts">
  /**
   * SvForm - a schema-driven form that renders the SvGrid UI-kit controls with
   * labels, required + custom validation, and a submit handler. The schema may be
   * a flat `FormField[]` or mix in titled `FormSection`s; with `stepper` the
   * sections become a validated wizard. Emits `onSubmit(values)` only when valid.
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
  import SvStepper from './SvStepper.svelte'
  import { isFormSection, type FormField, type FormEntry, type FormSection } from './form-field'
  import { createForm } from './createForm.svelte'

  type Props = {
    fields: ReadonlyArray<FormEntry>
    initial?: Record<string, any>
    /** Called with the visible-field values on a valid submit. May be async -
     *  the Submit button shows a loading state until it settles. */
    onSubmit?: (values: Record<string, any>) => void | Promise<void>
    onChange?: (values: Record<string, any>) => void
    /** When set, a secondary Cancel button renders next to Submit. */
    onCancel?: () => void
    submitLabel?: string
    cancelLabel?: string
    /** Show a Reset button that restores the initial values. */
    showReset?: boolean
    resetLabel?: string
    /** Render titled sections as a validated multi-step wizard (requires sections). */
    stepper?: boolean
    /** Columns in the responsive field grid (a section can override its own). */
    columns?: number
    disabled?: boolean
  }

  let {
    fields, initial = {}, onSubmit, onChange, onCancel,
    submitLabel = 'Submit', cancelLabel = 'Cancel', showReset = false, resetLabel = 'Reset',
    stepper = false, columns = 1, disabled = false,
  }: Props = $props()

  const form = createForm({ fields: () => fields, initial, onSubmit, onChange })
  const submit = (e: Event) => { e.preventDefault(); form.submit() }
  const dateVal = (v: any): Date | null => (v instanceof Date ? v : v ? new Date(v) : null)

  const sections = $derived(fields.filter(isFormSection) as FormSection[])
  const wizard = $derived(stepper && sections.length > 0)
  const stepItems = $derived(sections.map((s) => ({ label: s.section, description: s.description })))

  let step = $state(0)
  async function next() {
    const s = sections[step]
    if (!s) return
    const ok = await form.validateFields(s.fields.map((f) => f.name))
    if (ok && step < sections.length - 1) step += 1
  }
  const back = () => { if (step > 0) step -= 1 }

  // Shared shape passed to the `control` snippet so top-level fields and array
  // item fields render the same set of controls without duplication.
  type ControlOpts = {
    id: string
    type: string
    label: string
    value: any
    onChange: (v: any) => void
    onBlur?: () => void
    disabled: boolean
    placeholder?: string
    options?: ReadonlyArray<{ value: string | number; label: string; color?: string }>
  }
</script>

{#snippet control(o: ControlOpts)}
  {#if o.type === 'textarea'}
    <textarea id={o.id} class="sv-form__control sv-form__textarea" rows="3" disabled={o.disabled} placeholder={o.placeholder} value={o.value ?? ''} oninput={(e) => o.onChange(e.currentTarget.value)} onblur={o.onBlur}></textarea>
  {:else if o.type === 'number'}
    <SvNumberInput value={o.value ?? null} disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'password'}
    <SvPasswordInput value={o.value ?? ''} disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'select'}
    <SvDropDownList options={o.options ?? []} value={o.value ?? null} disabled={o.disabled} placeholder={o.placeholder} onChange={o.onChange} />
  {:else if o.type === 'checkbox'}
    <SvCheckBox checked={!!o.value} disabled={o.disabled} onChange={o.onChange}>{o.label}</SvCheckBox>
  {:else if o.type === 'switch'}
    <div class="sv-form__inline"><SvSwitchButton checked={!!o.value} disabled={o.disabled} onChange={o.onChange} ariaLabel={o.label} /><span>{o.label}</span></div>
  {:else if o.type === 'date'}
    <SvDateTimePicker value={dateVal(o.value)} dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'color'}
    <SvColorInput value={o.value ?? '#3b82f6'} disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'rating'}
    <SvRating value={o.value ?? 0} disabled={o.disabled} onChange={o.onChange} />
  {:else}
    <input id={o.id} class="sv-form__control" type={o.type} disabled={o.disabled} placeholder={o.placeholder} value={o.value ?? ''} oninput={(e) => o.onChange(e.currentTarget.value)} onblur={o.onBlur} />
  {/if}
{/snippet}

{#snippet renderItemField(arrayName: string, i: number, itf: FormField)}
  {@const type = itf.type ?? 'text'}
  {@const id = `f-${arrayName}-${i}-${itf.name}`}
  {@const err = form.itemError(arrayName, i, itf.name)}
  <div class="sv-form__field" class:has-error={err}>
    {#if type !== 'checkbox' && type !== 'switch'}
      <label class="sv-form__label" for={id}>{itf.label}{#if itf.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}</label>
    {/if}
    {@render control({ id, type, label: itf.label, value: form.itemValue(arrayName, i, itf.name), onChange: (v) => form.setItemValue(arrayName, i, itf.name, v), onBlur: () => form.handleItemBlur(arrayName, i, itf.name), disabled, placeholder: itf.placeholder, options: itf.options })}
    {#if err}<span class="sv-form__error" role="alert">{err}</span>{/if}
  </div>
{/snippet}

{#snippet renderArray(field: FormField)}
  <div class="sv-form__field is-full sv-form__array" class:has-error={form.error(field.name)}>
    <label class="sv-form__label">{field.label}{#if field.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}</label>
    {#each form.arrayItems(field.name) as _item, i (i)}
      <div class="sv-form__arow">
        <div class="sv-form__grid" style:--cols={field.itemFields?.length ?? 1}>
          {#each field.itemFields ?? [] as itf (itf.name)}{@render renderItemField(field.name, i, itf)}{/each}
        </div>
        <button type="button" class="sv-form__aremove" disabled={disabled} onclick={() => form.removeItem(field.name, i)} aria-label="Remove item">&times;</button>
      </div>
    {/each}
    <div><SvButton type="button" variant="outline" size="sm" disabled={disabled} onclick={() => form.addItem(field.name)}>{field.addLabel ?? '+ Add'}</SvButton></div>
    {#if form.error(field.name)}<span class="sv-form__error" role="alert">{form.error(field.name)}</span>{/if}
  </div>
{/snippet}

{#snippet renderField(field: FormField, cols: number)}
  {#if form.isVisible(field.name)}
    {@const type = field.type ?? 'text'}
    {#if type === 'array'}
      {@render renderArray(field)}
    {:else}
      {@const fieldDisabled = disabled || form.isDisabled(field.name)}
      <div class="sv-form__field" class:is-full={field.full || cols === 1} class:has-error={form.error(field.name)}>
        {#if type !== 'checkbox' && type !== 'switch'}
          <label class="sv-form__label" for={`f-${field.name}`}>
            {field.label}{#if field.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}
          </label>
        {/if}
        {@render control({ id: `f-${field.name}`, type, label: field.label, value: form.value(field.name), onChange: (v) => form.setValue(field.name, v), onBlur: () => form.handleBlur(field.name), disabled: fieldDisabled, placeholder: field.placeholder, options: field.options })}
        {#if form.error(field.name)}
          <span class="sv-form__error" role="alert">{form.error(field.name)}</span>
        {:else if form.isValidating(field.name)}
          <span class="sv-form__checking" role="status"><span class="sv-form__spinner" aria-hidden="true"></span>Checking…</span>
        {/if}
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet grid(flds: ReadonlyArray<FormField>, cols: number)}
  <div class="sv-form__grid" style:--cols={cols}>
    {#each flds as field (field.name)}{@render renderField(field, cols)}{/each}
  </div>
{/snippet}

{#snippet actions()}
  <div class="sv-form__actions">
    {#if showReset}
      <SvButton type="button" variant="ghost" disabled={disabled || form.submitting} onclick={() => form.reset()}>{resetLabel}</SvButton>
    {/if}
    {#if onCancel}
      <SvButton type="button" variant="secondary" disabled={disabled || form.submitting} onclick={onCancel}>{cancelLabel}</SvButton>
    {/if}
    <SvButton type="submit" loading={form.submitting} disabled={disabled || form.submitting}>{submitLabel}</SvButton>
  </div>
{/snippet}

<form class="sv-form" onsubmit={submit} novalidate>
  {#if wizard}
    {@const s = sections[Math.min(step, sections.length - 1)]!}
    <SvStepper steps={stepItems} current={step} onChange={(n) => (step = n)} linear />
    <fieldset class="sv-form__section">
      {#if s.description}<p class="sv-form__section-desc">{s.description}</p>{/if}
      {@render grid(s.fields, s.columns ?? columns)}
    </fieldset>
    <div class="sv-form__actions">
      {#if step > 0}
        <SvButton type="button" variant="secondary" disabled={form.submitting} onclick={back}>Back</SvButton>
      {/if}
      <span class="sv-form__spacer"></span>
      {#if step < sections.length - 1}
        <SvButton type="button" disabled={form.submitting} onclick={next}>Next</SvButton>
      {:else}
        {#if showReset}
          <SvButton type="button" variant="ghost" disabled={disabled || form.submitting} onclick={() => { form.reset(); step = 0 }}>{resetLabel}</SvButton>
        {/if}
        <SvButton type="submit" loading={form.submitting} disabled={disabled || form.submitting}>{submitLabel}</SvButton>
      {/if}
    </div>
  {:else if sections.length > 0}
    {#each fields as entry (isFormSection(entry) ? entry.section : entry.name)}
      {#if isFormSection(entry)}
        <fieldset class="sv-form__section">
          <legend class="sv-form__section-title">{entry.section}</legend>
          {#if entry.description}<p class="sv-form__section-desc">{entry.description}</p>{/if}
          {@render grid(entry.fields, entry.columns ?? columns)}
        </fieldset>
      {:else}
        {@render grid([entry], columns)}
      {/if}
    {/each}
    {@render actions()}
  {:else}
    {@render grid(fields as ReadonlyArray<FormField>, columns)}
    {@render actions()}
  {/if}
</form>

<style>
  .sv-form { --_accent: var(--sg-accent, #2563eb); width: 100%; display: flex; flex-direction: column; gap: 16px; }
  .sv-form__grid { display: grid; grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr)); gap: 14px 18px; }
  .sv-form__section { border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 16px; margin: 0; min-inline-size: 0; }
  .sv-form__section-title { font-size: 13px; font-weight: 700; color: var(--sg-fg, #0f172a); padding: 0 4px; }
  .sv-form__section-desc { margin: 0 0 12px; font-size: 12px; color: var(--sg-muted, #64748b); }
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
  .sv-form__checking { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .sv-form__spinner {
    width: 11px; height: 11px; border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--_accent) 30%, transparent);
    border-top-color: var(--_accent); animation: sv-form-spin 0.6s linear infinite;
  }
  @keyframes sv-form-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .sv-form__spinner { animation: none; } }
  .sv-form__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  .sv-form__spacer { flex: 1; }
  .sv-form__array { gap: 8px; }
  .sv-form__arow { display: flex; align-items: flex-start; gap: 8px; }
  .sv-form__arow > .sv-form__grid { flex: 1; padding: 10px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; }
  .sv-form__aremove {
    flex: none; width: 28px; height: 28px; margin-top: 10px; border-radius: 6px; cursor: pointer;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff);
    color: var(--sg-muted, #64748b); font-size: 16px; line-height: 1;
  }
  .sv-form__aremove:hover:not(:disabled) { color: var(--sg-danger, #dc2626); border-color: var(--sg-danger, #dc2626); }
  .sv-form__aremove:disabled { opacity: 0.5; cursor: default; }
</style>
