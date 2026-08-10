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
  import { untrack } from 'svelte'
  import SvNumberInput from './SvNumberInput.svelte'
  import SvPasswordInput from './SvPasswordInput.svelte'
  import SvDropDownList from './SvDropDownList.svelte'
  import SvMultiSelect from './SvMultiSelect.svelte'
  import SvCheckBox from './SvCheckBox.svelte'
  import SvSwitchButton from './SvSwitchButton.svelte'
  import SvDateTimePicker from './SvDateTimePicker.svelte'
  import SvColorInput from './SvColorInput.svelte'
  import SvRating from './SvRating.svelte'
  import SvRadioGroup from './SvRadioGroup.svelte'
  import SvSlider from './SvSlider.svelte'
  import SvTagsInput from './SvTagsInput.svelte'
  import SvPhoneInput from './SvPhoneInput.svelte'
  import SvCountryInput from './SvCountryInput.svelte'
  import SvMaskedInput from './SvMaskedInput.svelte'
  import SvComboBox from './SvComboBox.svelte'
  import SvFileUpload from './SvFileUpload.svelte'
  import SvButton from './SvButton.svelte'
  import SvStepper from './SvStepper.svelte'
  import SvTabs from './SvTabs.svelte'
  import { isFormSection, type FormField, type FormEntry, type FormSection } from './form-field'
  import { createForm, type FormMessages } from './createForm.svelte'
  import type { EditorDir } from './editor-contract'

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
    /** Render titled sections as tabs (requires sections; ignored with `stepper`). */
    tabs?: boolean
    /** Columns in the responsive field grid (a section can override its own). */
    columns?: number
    disabled?: boolean
    /** Inject server-side errors (`{ field: message }`); applied reactively. */
    serverErrors?: Record<string, string>
    /** A form-level error message shown in a banner above the fields. */
    formError?: string
    /** Show a summary of field errors (with focus links) above the form after a
     *  failed submit. */
    errorSummary?: boolean
    /** Heading for the error summary. Default "Please fix the following:". */
    errorSummaryTitle?: string
    /**
     * Re-seed the form when the `initial` object identity changes (e.g. editing a
     * different record). `off` (default) seeds once; `always` re-seeds on every
     * change; `ifPristine` re-seeds only when the user has no unsaved edits.
     */
    reinitialize?: 'off' | 'always' | 'ifPristine'
    /** Text direction; `rtl` mirrors the form layout. */
    dir?: EditorDir
    /** Override the built-in generated strings (required / min-max items / checking). */
    messages?: Partial<FormMessages>
  }

  let {
    fields, initial = {}, onSubmit, onChange, onCancel,
    submitLabel = 'Submit', cancelLabel = 'Cancel', showReset = false, resetLabel = 'Reset',
    stepper = false, tabs = false, columns = 1, disabled = false,
    serverErrors, formError, errorSummary = false, errorSummaryTitle = 'Please fix the following:',
    reinitialize = 'off', dir, messages,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  const form = createForm({ fields: () => fields, initial, onSubmit, onChange, messages })
  async function submit(e: Event) {
    e.preventDefault()
    const ok = await form.submit()
    // In tabs mode, surface the first tab that has an error so it is not hidden.
    if (!ok && tabbed) {
      const first = form.firstErrorField()
      const s = first ? sections.find((sec) => sec.fields.some((f) => f.name === first)) : undefined
      if (s) activeTab = s.section
    }
  }

  let formEl = $state<HTMLFormElement | null>(null)
  // Apply server-side errors reactively (e.g. after a failed API submit). The
  // write is untracked so reading `errors` inside setErrors does not make this
  // effect depend on (and re-run from) its own write.
  $effect(() => {
    const se = serverErrors
    if (se) untrack(() => form.setErrors(se))
  })

  // Opt-in re-seed when the `initial` identity changes. Only `initial` is tracked
  // (read outside `untrack`); the isDirty check + reset run untracked so this
  // never re-fires from its own writes.
  let seeded = false
  $effect(() => {
    const init = initial
    untrack(() => {
      if (!seeded) { seeded = true; return } // the seed-once mount pass
      if (reinitialize === 'off') return
      if (reinitialize === 'ifPristine' && form.isDirty) return
      form.reset(init)
    })
  })

  const summaryItems = $derived(errorSummary ? form.errorList() : [])
  function focusField(name: string) {
    const wrap = formEl?.querySelector<HTMLElement>(`[data-field="${name}"]`)
    wrap?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    wrap?.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus()
  }
  const dateVal = (v: any): Date | null => (v instanceof Date ? v : v ? new Date(v) : null)
  // Resolve a field's options, running the function form (cascading) against the
  // live values so a child list updates when its parent changes.
  const resolveOptions = (field: FormField) =>
    typeof field.options === 'function' ? field.options(form.values) : (field.options ?? [])

  const sections = $derived(fields.filter(isFormSection) as FormSection[])
  const wizard = $derived(stepper && sections.length > 0)
  const tabbed = $derived(tabs && !stepper && sections.length > 0)
  const stepItems = $derived(sections.map((s) => ({ label: s.section, description: s.description })))

  let activeTab = $state<string | undefined>(undefined)
  const sectionHasError = (s: FormSection) => s.fields.some((f) => form.error(f.name))
  const tabItems = $derived(sections.map((s) => ({ id: s.section, label: sectionHasError(s) ? `${s.section} ⚠` : s.section })))

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
    readonly?: boolean
    invalid?: boolean
    describedby?: string
    placeholder?: string
    options?: ReadonlyArray<{ value: string | number; label: string; color?: string }>
    /** The source field, for type-specific extras (mask, min/max, loadOptions...). */
    field?: FormField
  }
</script>

{#snippet control(o: ControlOpts)}
  {#if o.type === 'textarea'}
    <textarea id={o.id} class="sv-form__control sv-form__textarea" rows="3" disabled={o.disabled} readonly={o.readonly} placeholder={o.placeholder} value={o.value ?? ''} aria-invalid={o.invalid ? 'true' : undefined} aria-describedby={o.describedby} oninput={(e) => o.onChange(e.currentTarget.value)} onblur={o.onBlur}></textarea>
  {:else if o.type === 'number'}
    <SvNumberInput id={o.id} value={o.value ?? null} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} block min={o.field?.min ?? -Infinity} max={o.field?.max ?? Infinity} step={o.field?.step ?? 1} precision={o.field?.precision} prefix={o.field?.prefix ?? ''} suffix={o.field?.suffix ?? ''} onChange={o.onChange} />
  {:else if o.type === 'password'}
    <SvPasswordInput id={o.id} value={o.value ?? ''} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} block onChange={o.onChange} />
  {:else if o.type === 'mask'}
    <SvMaskedInput id={o.id} value={o.value ?? ''} mask={o.field?.mask ?? ''} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} block placeholder={o.placeholder} onChange={(m) => o.onChange(m)} />
  {:else if o.type === 'phone'}
    <SvPhoneInput id={o.id} value={o.value ?? ''} disabled={o.disabled} invalid={o.invalid} block placeholder={o.placeholder} onChange={(v) => o.onChange(v)} />
  {:else if o.type === 'country'}
    <SvCountryInput id={o.id} value={o.value ?? null} disabled={o.disabled} invalid={o.invalid} onChange={o.onChange} />
  {:else if o.type === 'select'}
    <SvDropDownList id={o.id} options={o.options ?? []} value={o.value ?? null} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} placeholder={o.placeholder} onChange={o.onChange} />
  {:else if o.type === 'combobox'}
    <SvComboBox id={o.id} options={o.options ?? []} value={o.value ?? null} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} clearable placeholder={o.placeholder} loadOptions={o.field?.loadOptions ? (q) => o.field!.loadOptions!(q, form.values) : undefined} onChange={o.onChange} />
  {:else if o.type === 'multiselect'}
    <SvMultiSelect id={o.id} options={o.options ?? []} value={Array.isArray(o.value) ? o.value : []} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} placeholder={o.placeholder} onChange={o.onChange} />
  {:else if o.type === 'radio'}
    <SvRadioGroup id={o.id} options={o.options ?? []} value={o.value ?? null} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} orientation="horizontal" onChange={o.onChange} />
  {:else if o.type === 'tags'}
    <SvTagsInput id={o.id} value={Array.isArray(o.value) ? o.value : []} disabled={o.disabled} invalid={o.invalid} placeholder={o.placeholder} onChange={o.onChange} />
  {:else if o.type === 'slider'}
    <SvSlider id={o.id} value={o.value ?? o.field?.min ?? 0} min={o.field?.min ?? 0} max={o.field?.max ?? 100} step={o.field?.step ?? 1} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} showValue onChange={o.onChange} />
  {:else if o.type === 'checkbox'}
    <SvCheckBox checked={!!o.value} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} onChange={o.onChange}>{o.label}</SvCheckBox>
  {:else if o.type === 'switch'}
    <div class="sv-form__inline"><SvSwitchButton checked={!!o.value} disabled={o.disabled} readonly={o.readonly} onChange={o.onChange} ariaLabel={o.label} /><span>{o.label}</span></div>
  {:else if o.type === 'date'}
    <SvDateTimePicker value={dateVal(o.value)} dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'datetime'}
    <SvDateTimePicker value={dateVal(o.value)} dropDownDisplayMode="both" disabled={o.disabled} onChange={o.onChange} />
  {:else if o.type === 'color'}
    <SvColorInput id={o.id} value={o.value ?? '#3b82f6'} disabled={o.disabled} invalid={o.invalid} onChange={o.onChange} />
  {:else if o.type === 'file'}
    <SvFileUpload accept={o.field?.accept} multiple={o.field?.multiple ?? false} onChange={o.onChange} />
  {:else if o.type === 'rating'}
    <SvRating id={o.id} value={o.value ?? 0} disabled={o.disabled} readonly={o.readonly} invalid={o.invalid} onChange={o.onChange} />
  {:else}
    <input id={o.id} class="sv-form__control" type={o.type} disabled={o.disabled} readonly={o.readonly} placeholder={o.placeholder} value={o.value ?? ''} aria-invalid={o.invalid ? 'true' : undefined} aria-describedby={o.describedby} oninput={(e) => o.onChange(e.currentTarget.value)} onblur={o.onBlur} />
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
    {@render control({ id, type, label: itf.label, value: form.itemValue(arrayName, i, itf.name), onChange: (v) => form.setItemValue(arrayName, i, itf.name, v), onBlur: () => form.handleItemBlur(arrayName, i, itf.name), disabled, readonly: itf.readonly, invalid: !!err, describedby: err ? `${id}__error` : undefined, placeholder: itf.placeholder, options: resolveOptions(itf), field: itf })}
    {#if err}<span class="sv-form__error" id={`${id}__error`} role="alert">{err}</span>{/if}
  </div>
{/snippet}

{#snippet renderArray(field: FormField)}
  {@const count = form.arrayItems(field.name).length}
  <div class="sv-form__field is-full sv-form__array" class:has-error={form.error(field.name)}>
    <label class="sv-form__label">{field.label}{#if field.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}</label>
    {#each form.arrayItems(field.name) as _item, i (i)}
      <div class="sv-form__arow">
        <div class="sv-form__grid" style:--cols={field.itemFields?.length ?? 1}>
          {#each field.itemFields ?? [] as itf (itf.name)}{@render renderItemField(field.name, i, itf)}{/each}
        </div>
        <div class="sv-form__arow-tools">
          {#if count > 1}
            <div class="sv-form__amove">
              <button type="button" class="sv-form__amove-btn" disabled={disabled || i === 0} onclick={() => form.moveItem(field.name, i, i - 1)} aria-label="Move up" title="Move up">&#8593;</button>
              <button type="button" class="sv-form__amove-btn" disabled={disabled || i === count - 1} onclick={() => form.moveItem(field.name, i, i + 1)} aria-label="Move down" title="Move down">&#8595;</button>
            </div>
          {/if}
          <button type="button" class="sv-form__aremove" disabled={disabled} onclick={() => form.removeItem(field.name, i)} aria-label="Remove item">&times;</button>
        </div>
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
      <div class="sv-form__field" data-field={field.name} class:is-full={(field.full || (field.span ?? 1) >= cols) || cols === 1} class:has-error={form.error(field.name)} style:grid-column={field.span && field.span > 1 && field.span < cols ? `span ${field.span}` : undefined}>
        {#if type !== 'checkbox' && type !== 'switch'}
          <label class="sv-form__label" for={`f-${field.name}`}>
            {field.label}{#if field.required}<span class="sv-form__req" aria-hidden="true"> *</span>{/if}
          </label>
        {/if}
        {@render control({ id: `f-${field.name}`, type, label: field.label, value: form.value(field.name), onChange: (v) => form.setValue(field.name, v), onBlur: () => form.handleBlur(field.name), disabled: fieldDisabled, readonly: field.readonly || !!field.computed, invalid: !!form.error(field.name), describedby: form.error(field.name) ? `f-${field.name}__error` : undefined, placeholder: field.placeholder, options: resolveOptions(field), field })}
        {#if form.error(field.name)}
          <span class="sv-form__error" id={`f-${field.name}__error`} role="alert">{form.error(field.name)}</span>
        {:else if form.isValidating(field.name)}
          <span class="sv-form__checking" role="status"><span class="sv-form__spinner" aria-hidden="true"></span>{form.messages.checking}</span>
        {:else if field.help}
          <span class="sv-form__help">{field.help}</span>
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

<form class="sv-form" bind:this={formEl} dir={resolvedDir} onsubmit={submit} novalidate>
  {#if formError}
    <div class="sv-form__banner" role="alert">{formError}</div>
  {/if}
  {#if errorSummary && summaryItems.length}
    <div class="sv-form__summary" role="alert">
      <p class="sv-form__summary-title">{errorSummaryTitle}</p>
      <ul>
        {#each summaryItems as it (it.name)}
          <li><button type="button" class="sv-form__summary-link" onclick={() => focusField(it.name)}>{it.label}: {it.message}</button></li>
        {/each}
      </ul>
    </div>
  {/if}
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
  {:else if tabbed}
    <SvTabs tabs={tabItems} bind:value={activeTab} ariaLabel="Form sections">
      {#snippet panel(id)}
        {@const s = sections.find((sec) => sec.section === id)}
        {#if s}
          {#if s.description}<p class="sv-form__section-desc">{s.description}</p>{/if}
          {@render grid(s.fields, s.columns ?? columns)}
        {/if}
      {/snippet}
    </SvTabs>
    {@render actions()}
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
  .sv-form__help { font-size: 11.5px; color: var(--sg-muted, #64748b); }
  .sv-form__banner {
    padding: 10px 12px; border-radius: 8px; font-size: 13px;
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 10%, transparent);
    color: var(--sg-danger, #dc2626); border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 35%, transparent);
  }
  .sv-form__summary {
    padding: 12px 14px; border-radius: 8px;
    background: color-mix(in srgb, var(--sg-danger, #dc2626) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--sg-danger, #dc2626) 30%, transparent);
  }
  .sv-form__summary-title { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: var(--sg-danger, #dc2626); }
  .sv-form__summary ul { margin: 0; padding-inline-start: 18px; display: flex; flex-direction: column; gap: 3px; }
  .sv-form__summary-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; text-align: start;
    color: var(--sg-danger, #dc2626); cursor: pointer; text-decoration: underline;
  }
  .sv-form__summary-link:hover { color: var(--sg-fg, #0f172a); }
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
  .sv-form__arow-tools { display: flex; align-items: center; gap: 4px; margin-top: 10px; }
  .sv-form__amove { display: inline-flex; flex-direction: column; }
  .sv-form__amove-btn {
    width: 22px; height: 14px; display: grid; place-items: center; padding: 0; cursor: pointer;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff); color: var(--sg-muted, #64748b);
    font-size: 10px; line-height: 1;
  }
  .sv-form__amove-btn:first-child { border-radius: 6px 6px 0 0; border-bottom: 0; }
  .sv-form__amove-btn:last-child { border-radius: 0 0 6px 6px; }
  .sv-form__amove-btn:hover:not(:disabled) { color: var(--sg-accent, #2563eb); }
  .sv-form__amove-btn:disabled { opacity: 0.4; cursor: default; }
  .sv-form__arow-tools .sv-form__aremove { margin-top: 0; }
</style>
