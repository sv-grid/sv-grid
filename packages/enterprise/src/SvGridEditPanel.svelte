<script lang="ts" module>
  type EditRow = Record<string, unknown>
</script>

<script lang="ts" generics="TData extends EditRow">
  /**
   * SvGridEditPanel - schema-driven create / edit form. The commercial
   * counterpart to the grid: it renders fields from an `EntitySchema` (via
   * `schemaToFormFields`), validates them (built-in + Standard Schema), and
   * hands a ready payload to `onSubmit` so you can call a `ServerController`'s
   * `createRow` / `updateRow`.
   *
   * Presents as a right-hand **drawer** (default), a centered **modal**, or
   * **inline**. Themed with the grid's `--sg-*` tokens, so it follows light /
   * dark automatically.
   *
   *   <SvGridEditPanel {schema} row={editing} presentation="drawer"
   *     onCancel={() => (editing = undefined)}
   *     onSubmit={async ({ mode, id, values }) => {
   *       if (mode === 'create') await controller.createRow(values)
   *       else await controller.updateRow(id, values)
   *       editing = undefined
   *     }} />
   */
  import { fade, fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { SvGridDropdown, SvNumberInput, SvColorInput, SvPasswordInput, SvSlider, SvSwitchButton, SvPhoneInput, SvCountryInput, SvMaskedInput, SvDateTimePicker, SvTagsInput, type CellEditorOption } from '@svgrid/grid'
  import { schemaToFormFields, type EntitySchema, type FormFieldDescriptor, type FormSection } from './schema'
  import SvFileInput from './SvFileInput.svelte'
  import {
    buildInitialValues,
    controlKind,
    editMode,
    rowId,
    toSubmitValues,
    validateAll,
    toDateString,
    toDateTimeString,
    toNumberValue,
    fromNumberValue,
    toSliderValue,
    toTags,
    fieldState,
    sectionVisible,
    validateOne,
    type EditMode,
    type FieldState,
  } from './edit-panel'
  import SvLookupInput from './SvLookupInput.svelte'
  import type { RelationLookup } from './sources/relation-lookup'

  type SubmitPayload = { mode: EditMode; id: string | null; values: Partial<TData> }
  type Presentation = 'drawer' | 'modal' | 'inline'


  type Props = {
    schema: EntitySchema<TData>
    row?: TData | null
    open?: boolean
    title?: string
    submitLabel?: string
    /** 'drawer' (right slide-over, default), 'modal' (centered popup), or 'inline'. */
    presentation?: Presentation
    /**
     * Lookup providers keyed by field name. A `relation` field with a lookup
     * renders a searchable picker (search the related entity, store the key).
     * Build them with `createRelationLookup`.
     */
    lookups?: Record<string, RelationLookup>
    /** File/image upload handlers by field name (return the URL to store). */
    uploads?: Record<string, (file: File) => Promise<string>>
    /**
     * Dependent (cascading) options by field name - compute a field's choices
     * from the current form values, e.g. City from Country. The field's value is
     * cleared when it stops being a valid option.
     */
    dependentOptions?: Record<string, (values: Partial<TData>) => ReadonlyArray<CellEditorOption>>
    /**
     * Remember the floating modal's window layout (pin / size / maximized) in
     * localStorage under this key, so it reopens where the user left it.
     */
    persistKey?: string
    /** Form column count. Defaults to the schema's `form.columns`, else 2. A field
     *  with `span: 2` spans all columns. */
    columns?: 1 | 2 | 3
    /** Restrict + order the form fields (by field name). Default: all schema fields. */
    formFields?: string[]
    /** Group fields into titled fieldsets, overriding the schema's `form.sections`.
     *  Fields not in any section render in a trailing default group. When set,
     *  `formFields` ordering is per-section. */
    sections?: FormSection[]
    /** Ask one section at a time (Back / Next). Defaults to the schema's `form.steps`. */
    steps?: boolean
    /** Dialog width for the modal / drawer presentations. Default 'md'. */
    formSize?: 'sm' | 'md' | 'lg'
    onSubmit: (payload: SubmitPayload) => void | Promise<void>
    onCancel?: () => void
  }

  let {
    schema,
    row = null,
    open = true,
    title,
    submitLabel,
    presentation = 'drawer',
    lookups,
    uploads,
    dependentOptions,
    persistKey,
    columns,
    formFields,
    sections,
    steps,
    formSize = 'md',
    onSubmit,
    onCancel,
  }: Props = $props()

  let values = $state<Record<string, any>>({})
  let errors = $state<Record<string, string>>({})
  let submitting = $state(false)
  let submitError = $state<string | null>(null)
  // Fields the user has finished with. A field is only allowed to show an error
  // once they have left it, so a form does not scold you for what you have not
  // typed yet; after a failed submit everything counts as visited.
  let touched = $state<Record<string, boolean>>({})
  let submitAttempted = $state(false)

  const allFields = $derived(schemaToFormFields(schema))
  // Apply the include/order list (formFields), else keep the schema order.
  const listedFields = $derived(
    formFields && formFields.length
      ? (formFields.map((name) => allFields.find((f) => f.field === name)).filter(Boolean) as FormFieldDescriptor[])
      : allFields,
  )
  // Live state per field: a `when` condition re-evaluates against the current
  // values, so answering one question can reveal, lock, or demand another.
  const fieldStates = $derived(new Map(allFields.map((f) => [f.field, fieldState(f, values)] as const)))
  const stateOf = (f: FormFieldDescriptor): FieldState =>
    fieldStates.get(f.field) ?? { visible: true, disabled: f.readonly, required: f.required }
  const fields = $derived(listedFields.filter((f) => stateOf(f).visible))
  // The arrangement comes from the schema (so a built form travels with the
  // entity); the props override it for a one-off layout of a shared schema.
  const layoutColumns = $derived(columns ?? schema.form?.columns ?? 2)
  const layoutSections = $derived(sections ?? schema.form?.sections)

  // Grouped layout: each section's resolvable fields, plus a trailing group for
  // anything not assigned to a section (so no field is ever silently dropped).
  // Read straight off the layout, not off `fieldGroups` - the grouping needs to
  // know whether we are stepping, so it cannot be what decides it.
  const wantSteps = $derived(!!(steps ?? schema.form?.steps) && !!layoutSections?.length)
  const fieldGroups = $derived.by((): Array<{ title?: string; description?: string; columns?: 1 | 2 | 3; collapsible?: boolean; key: string; fields: FormFieldDescriptor[] }> => {
    if (!layoutSections || !layoutSections.length) return [{ key: '', fields }]
    const assigned = new Set<string>()
    const groups = layoutSections.map((s, i) => {
      const gf = s.fields.map((name) => fields.find((f) => f.field === name)).filter(Boolean) as FormFieldDescriptor[]
      for (const f of gf) assigned.add(f.field)
      // A section can be conditional in its own right, the same way a field is.
      const shown = s.visibleWhen ? sectionVisible(s.visibleWhen, values) : true
      return { title: s.title, description: s.description, columns: s.columns, collapsible: s.collapsible, key: `${i}`, fields: shown ? gf : [] }
    })
    const rest = fields.filter((f) => !assigned.has(f.field))
    // A section whose fields are all hidden by a condition disappears with them,
    // rather than leaving a heading over nothing.
    const shown = groups.filter((g) => g.fields.length)
    if (!rest.length) return shown
    // Stepping, the leftovers join the last step rather than becoming a step of
    // their own: an untitled "Step 4" holding whatever nobody placed is a
    // mystery, and every step of a wizard should be deliberate.
    if (wantSteps && shown.length) {
      const last = shown[shown.length - 1]!
      return [...shown.slice(0, -1), { ...last, fields: [...last.fields, ...rest] }]
    }
    return [...shown, { key: 'rest', fields: rest }]
  })

  // Which collapsible sections the user has folded away. Seeded from the
  // layout's `collapsed`, then owned by the user for the life of the form.
  let folded = $state<Record<string, boolean>>({})
  $effect(() => {
    const seed: Record<string, boolean> = {}
    ;(layoutSections ?? []).forEach((s, i) => { if (s.collapsible && s.collapsed) seed[`${i}`] = true })
    folded = seed
  })
  /**
   * A folded section is a display state, not a condition - its fields are still
   * validated. So a section holding an error is forced open: a failed submit
   * must never point at something the user cannot see.
   */
  const groupHasError = (g: { fields: FormFieldDescriptor[] }) => g.fields.some((f) => shownErrors[f.field])
  // Never folded while stepping: a step is already one group at a time, and a
  // step you have to unfold before you can fill it in is just an extra click.
  const isFolded = (g: { key: string; collapsible?: boolean; fields: FormFieldDescriptor[] }) =>
    !stepped && !!g.collapsible && !!folded[g.key] && !groupHasError(g)

  // --- Steps -----------------------------------------------------------------
  // One section at a time. The groups are already the steps (a section hidden by
  // its condition has been filtered out upstream, so the count follows the
  // answers), which is why there is no second list to keep in sync.
  const stepped = $derived(wantSteps && fieldGroups.length > 1)
  let step = $state(0)
  // Clamp rather than reset: answering something that hides a later section must
  // not throw the user back to the beginning.
  const stepIndex = $derived(stepped ? Math.min(step, fieldGroups.length - 1) : 0)
  const visibleGroups = $derived(stepped ? [fieldGroups[stepIndex]!] : fieldGroups)
  const isLastStep = $derived(stepIndex === fieldGroups.length - 1)

  /**
   * Move to the next step, but only once this one is clean. Validating just the
   * step you are on is the point of a wizard: errors surface where they were
   * made instead of arriving in a heap at the end.
   */
  async function nextStep() {
    const group = fieldGroups[stepIndex]
    if (!group) return
    let bad = false
    for (const f of group.fields) {
      touched[f.field] = true
      const message = await validateOne(schema, f.field, values)
      if (message) { errors[f.field] = message; bad = true }
      else delete errors[f.field]
    }
    if (bad) {
      const first = group.fields.find((f) => errors[f.field])
      if (first) focusField(first.field)
      return
    }
    step = stepIndex + 1
  }

  // Options for the custom dropdown: prepend a blank "clear" option for
  // non-required fields (parity with the native select's empty option).
  const selectOptions = (f: FormFieldDescriptor) =>
    f.required ? (f.options ?? []) : [{ value: '', label: '—' }, ...(f.options ?? [])]
  const mode = $derived(editMode(row))
  const heading = $derived(
    title ?? `${mode === 'create' ? 'New' : 'Edit'} ${schema.label ?? schema.name}`,
  )
  const overlayed = $derived(presentation !== 'inline')

  // The values the form opened with, to tell an edited form from an untouched one.
  let initial = $state<Record<string, any>>({})

  $effect(() => {
    // Seed from a local, and copy from that local rather than from `values`:
    // reading the state this effect also writes makes the effect its own
    // dependency, which spins forever.
    const seeded = buildInitialValues(schema, row)
    values = seeded
    initial = { ...seeded }
    errors = {}
    touched = {}
    submitAttempted = false
    step = 0
    submitError = null
    confirmingDiscard = false
  })

  // Cascade: when a parent field changes, clear a dependent field whose value is
  // no longer among its (recomputed) options.
  $effect(() => {
    if (!dependentOptions) return
    for (const [field, optionsOf] of Object.entries(dependentOptions)) {
      const current = values[field]
      if (current == null || current === '') continue
      if (!optionsOf(values as Partial<TData>).some((o) => String(o.value) === String(current))) values[field] = ''
    }
  })

  // Live recompute: a computed (derived) field re-evaluates as the form changes.
  // The value is read-only in the form and stripped from the submit payload.
  $effect(() => {
    for (const f of fields) {
      if (!f.computed) continue
      const next = f.computed(values as Record<string, unknown>)
      if (values[f.field] !== next) values[f.field] = next
    }
  })

  /**
   * Re-check one field as the user leaves it. Once a field has an error it keeps
   * being checked on every keystroke, so a correction clears the message
   * immediately instead of making them submit again to find out.
   */
  async function checkField(field: string) {
    touched[field] = true
    const message = await validateOne(schema, field, values)
    if (message) errors[field] = message
    else delete errors[field]
  }

  // Live re-validation, but only for fields already showing an error.
  $effect(() => {
    void values
    for (const field of Object.keys(errors)) void checkField(field)
  })

  /** Errors the form is allowed to show: visited fields, or everything after a submit. */
  const shownErrors = $derived(
    Object.fromEntries(Object.entries(errors).filter(([field]) => submitAttempted || touched[field])),
  )
  const errorList = $derived(
    fields.filter((f) => shownErrors[f.field]).map((f) => ({ field: f.field, label: f.label, message: shownErrors[f.field]! })),
  )

  /** Send focus to a field from the error summary. */
  function focusField(field: string) {
    const el = document.getElementById(`sv-ef-${field}`)
    if (el instanceof HTMLElement) el.focus()
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    // Enter in a text field still submits a form even with no submit button on
    // screen. Mid-wizard that would save a half-filled record, so it advances
    // instead - the same thing Next does.
    if (stepped && !isLastStep) { void nextStep(); return }
    submitError = null
    submitAttempted = true
    const found = await validateAll(schema, values)
    errors = found
    if (Object.keys(found).length > 0) {
      // Put the user on the first thing they need to fix - and, when stepping,
      // on the step it is actually on, or the focus would land off-screen.
      const first = fields.find((f) => found[f.field])
      if (stepped && first) {
        const at = fieldGroups.findIndex((g) => g.fields.some((f) => found[f.field]))
        if (at >= 0) step = at
      }
      if (first) focusField(first.field)
      return
    }
    submitting = true
    try {
      await onSubmit({
        mode,
        id: mode === 'edit' && row ? rowId(schema, row) : null,
        values: toSubmitValues(schema, values),
      })
    } catch (err) {
      submitError = err instanceof Error ? err.message : String(err)
    } finally {
      submitting = false
    }
  }

  /**
   * Guard against throwing away edits. Closing a dirty form asks first, in the
   * footer rather than through a `confirm()` dialog, so the answer appears where
   * the user is already looking and the form stays on screen behind it.
   */
  let confirmingDiscard = $state(false)
  const isDirty = $derived(
    !submitting && fields.some((f) => !f.readonly && String(values[f.field] ?? '') !== String(initial[f.field] ?? '')),
  )

  function close() {
    if (isDirty && !confirmingDiscard) {
      confirmingDiscard = true
      return
    }
    confirmingDiscard = false
    onCancel?.()
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !onCancel) return
    // A second Escape confirms, so the keyboard path is not a dead end.
    close()
  }
  function stop(e: Event) {
    e.stopPropagation()
  }

  // Pop entrance for the modal: fade + lift + scale, so it doesn't fight the
  // flex-centered wrapper (a transform-based centering would clash with this).
  function pop(_node: Element, { duration = 240 } = {}) {
    return {
      duration,
      easing: cubicOut,
      css: (t: number) => `opacity:${t};transform:translateY(${(1 - t) * 14}px) scale(${0.97 + 0.03 * t})`,
    }
  }

  // --- Floating window: drag, resize, edge-pin, maximize (modal presentation) -
  const floating = $derived(presentation === 'modal')
  type Pin = 'none' | 'left' | 'right' | 'top' | 'bottom'
  let pin = $state<Pin>('none')
  let pos = $state<{ x: number; y: number } | null>(null) // null = centered by the wrap's flex
  let size = $state<{ w: number; h: number } | null>(null)
  let maximized = $state(false)
  let panelEl = $state<HTMLElement>()

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  // Restore the saved window layout (pin / size / maximized), so it reopens
  // where the user left it. A function so the prop read stays inside a closure.
  const lsKey = () => (persistKey ? `svgrid.editpanel.${persistKey}` : null)
  {
    const key = lsKey()
    if (key && typeof localStorage !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (saved) {
          pin = saved.pin ?? 'none'
          size = saved.size ?? null
          maximized = !!saved.maximized
        }
      } catch { /* ignore bad json */ }
    }
  }
  $effect(() => {
    const key = lsKey()
    if (!key || typeof localStorage === 'undefined') return
    const layout = { pin, size, maximized } // read so the effect tracks them
    try { localStorage.setItem(key, JSON.stringify(layout)) } catch { /* quota / private mode */ }
  })

  const panelStyle = $derived.by(() => {
    if (!floating) return ''
    if (maximized) return 'position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0;'
    const w = size?.w
    const h = size?.h
    const edge = 'position:fixed;max-width:none;max-height:none;border-radius:0;'
    if (pin === 'left') return `${edge}left:0;top:0;height:100vh;width:${w ?? 440}px;`
    if (pin === 'right') return `${edge}right:0;top:0;height:100vh;width:${w ?? 440}px;`
    if (pin === 'top') return `${edge}top:0;left:0;width:100vw;height:${h ?? 380}px;`
    if (pin === 'bottom') return `${edge}bottom:0;left:0;width:100vw;height:${h ?? 380}px;`
    if (pos) return `position:fixed;left:${pos.x}px;top:${pos.y}px;width:${w ?? 460}px;${h ? `height:${h}px;` : ''}max-height:none;`
    // still centered by the wrap; only apply an explicit size if the user resized
    return `${w ? `width:${w}px;` : ''}${h ? `height:${h}px;max-height:none;` : ''}`
  })

  function setPin(p: Pin) {
    maximized = false
    pin = pin === p ? 'none' : p
    if (pin !== 'none') pos = null
  }
  function toggleMax() {
    maximized = !maximized
  }

  function startDrag(e: PointerEvent) {
    if (!floating || pin !== 'none' || maximized) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
    const r = panelEl?.getBoundingClientRect()
    if (!r) return
    if (!size) size = { w: r.width, h: r.height }
    pos = { x: r.left, y: r.top }
    const ox = r.left, oy = r.top, sx = e.clientX, sy = e.clientY, w = r.width
    const move = (ev: PointerEvent) => {
      pos = {
        x: clamp(ox + ev.clientX - sx, 0, Math.max(0, window.innerWidth - w)),
        y: clamp(oy + ev.clientY - sy, 0, Math.max(0, window.innerHeight - 40)),
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    e.preventDefault()
  }

  function startResize(e: PointerEvent, dir: string) {
    const r = panelEl?.getBoundingClientRect()
    if (!r) return
    if (pin === 'none' && !pos) pos = { x: r.left, y: r.top }
    const sx = e.clientX, sy = e.clientY, sw = r.width, sh = r.height
    const move = (ev: PointerEvent) => {
      let w = sw, h = sh
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (dir.includes('e')) w = Math.max(300, sw + dx)
      if (dir.includes('w')) w = Math.max(300, sw - dx)
      if (dir.includes('s')) h = Math.max(220, sh + dy)
      if (dir.includes('n')) h = Math.max(220, sh - dy)
      size = { w, h }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    e.preventDefault()
    e.stopPropagation()
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet pinIcon(side: 'left' | 'right' | 'top' | 'bottom')}
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
    {#if side === 'left'}<rect x="1.5" y="1.5" width="4" height="11" fill="currentColor" />{/if}
    {#if side === 'right'}<rect x="8.5" y="1.5" width="4" height="11" fill="currentColor" />{/if}
    {#if side === 'top'}<rect x="1.5" y="1.5" width="11" height="4" fill="currentColor" />{/if}
    {#if side === 'bottom'}<rect x="1.5" y="8.5" width="11" height="4" fill="currentColor" />{/if}
  </svg>
{/snippet}

{#snippet maxIcon(isMax: boolean)}
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3">
    {#if isMax}
      <rect x="4" y="1.5" width="8.5" height="8.5" rx="1.3" />
      <rect x="1.5" y="4" width="8.5" height="8.5" rx="1.3" fill="var(--ep-bg)" />
    {:else}
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
    {/if}
  </svg>
{/snippet}

{#snippet panelInner()}
  <form class="sv-ep__form" onsubmit={handleSubmit}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header
      class="sv-ep__header"
      class:sv-ep__header--drag={floating && pin === 'none' && !maximized}
      onpointerdown={floating ? startDrag : undefined}
    >
      <h2>{heading}</h2>
      <div class="sv-ep__tools">
        {#if floating}
          {#each ['left', 'top', 'bottom', 'right'] as const as side (side)}
            <button
              type="button"
              class="sv-ep__pin"
              class:is-active={pin === side}
              title={pin === side ? 'Unpin' : `Pin ${side}`}
              aria-label={pin === side ? 'Unpin' : `Pin ${side}`}
              onclick={() => setPin(side)}
            >{@render pinIcon(side)}</button>
          {/each}
          <button
            type="button"
            class="sv-ep__pin"
            class:is-active={maximized}
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onclick={toggleMax}
          >{@render maxIcon(maximized)}</button>
        {/if}
        {#if onCancel}
          <button type="button" class="sv-ep__close" aria-label="Close" onclick={close}>&times;</button>
        {/if}
      </div>
    </header>

    {#if errorList.length > 1}
      <!-- One place to see everything that needs fixing, with a jump to each.
           Only worth showing when more than one field failed. -->
      <div class="sv-ep__summary" role="alert">
        <p class="sv-ep__summary-title">Please fix {errorList.length} fields:</p>
        <ul>
          {#each errorList as e (e.field)}
            <li><button type="button" onclick={() => focusField(e.field)}>{e.label}: {e.message}</button></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if stepped}
      <!-- Where you are, and how much is left. Named steps beat "3 of 7": the
           titles are already written, so use them. -->
      <ol class="sv-ep__steps" aria-label="Form steps">
        {#each fieldGroups as g, gi (gi)}
          <li class="sv-ep__step" class:is-current={gi === stepIndex} class:is-done={gi < stepIndex} aria-current={gi === stepIndex ? 'step' : undefined}>
            <span class="sv-ep__step-dot" aria-hidden="true">{gi < stepIndex ? '✓' : gi + 1}</span>
            <span class="sv-ep__step-label">{g.title ?? `Step ${gi + 1}`}</span>
          </li>
        {/each}
      </ol>
    {/if}

    {#if fieldGroups.length > 1 || fieldGroups[0]?.title}
      {#each visibleGroups as g, gi (gi)}
        {@const shut = isFolded(g)}
        <div class="sv-ep__section">
          {#if g.collapsible && g.title}
            <!-- The heading becomes the control, so the whole row is the target
                 rather than a small chevron beside it. -->
            <h4 class="sv-ep__section-title">
              <button type="button" class="sv-ep__section-toggle" aria-expanded={!shut} aria-controls={`sv-eg-${gi}`} onclick={() => (folded[g.key] = !folded[g.key])}>
                <span class="sv-ep__section-caret" class:is-shut={shut} aria-hidden="true"></span>
                {g.title}
                {#if shut}<span class="sv-ep__section-count">{g.fields.length}</span>{/if}
              </button>
            </h4>
          {:else if g.title}
            <h4 class="sv-ep__section-title">{g.title}</h4>
          {/if}
          {#if g.description && !shut}<p class="sv-ep__section-desc">{g.description}</p>{/if}
          <div class="sv-ep__body" id={`sv-eg-${gi}`} hidden={shut} style="--sv-ep-cols: {g.columns ?? layoutColumns}">
            {#each g.fields as f (f.field)}{@render fieldRow(f)}{/each}
          </div>
        </div>
      {/each}
    {:else}
      <div class="sv-ep__body" style="--sv-ep-cols: {layoutColumns}">
        {#each fields as f (f.field)}{@render fieldRow(f)}{/each}
      </div>
    {/if}

    {#if submitError}<p class="sv-ep__submit-err" role="alert">{submitError}</p>{/if}

    <footer class="sv-ep__footer">
      {#if confirmingDiscard}
        <span class="sv-ep__discard" role="alert">Discard your changes?</span>
        <button type="button" class="sv-ep__btn" onclick={() => (confirmingDiscard = false)}>Keep editing</button>
        <button type="button" class="sv-ep__btn sv-ep__btn--danger" onclick={close}>Discard</button>
      {:else}
        {#if onCancel}
          <button type="button" class="sv-ep__btn" onclick={close} disabled={submitting}>Cancel</button>
        {/if}
        {#if stepped && stepIndex > 0}
          <button type="button" class="sv-ep__btn" onclick={() => (step = stepIndex - 1)} disabled={submitting}>Back</button>
        {/if}
        {#if stepped && !isLastStep}
          <!-- Not a submit button: Next validates this step only, and a stray
               Enter in a text field must not save a half-filled record. -->
          <button type="button" class="sv-ep__btn sv-ep__btn--primary" onclick={nextStep} disabled={submitting}>Next</button>
        {:else}
          <button type="submit" class="sv-ep__btn sv-ep__btn--primary" disabled={submitting}>
            {submitting ? 'Saving…' : (submitLabel ?? (mode === 'create' ? 'Create' : 'Save'))}
          </button>
        {/if}
      {/if}
    </footer>
  </form>
{/snippet}

{#snippet fieldRow(spec: FormFieldDescriptor)}
        {@const st = stateOf(spec)}
        <!-- Every control below already reads `readonly` / `required` off the
             descriptor, so folding the live condition state into a shadow copy
             makes all of them honour it without touching each branch. -->
        {@const f = st.disabled === spec.readonly && st.required === spec.required
          ? spec
          : { ...spec, readonly: st.disabled, required: st.required }}
        {@const kind = controlKind(f)}
        {@const lk = f.relation ? lookups?.[f.field] : undefined}
        {@const depOptions = dependentOptions?.[f.field]}
        {@const err = shownErrors[f.field]}
        <!-- Point screen readers at whichever of help / error is on screen. -->
        {@const describedBy = err ? `sv-ee-${f.field}` : f.help ? `sv-eh-${f.field}` : undefined}
        <div class="sv-ep-field" class:sv-ep-field--wide={f.span === 2} class:sv-ep-field--error={!!err}
          onfocusoutcapture={() => { if (!f.readonly) void checkField(f.field) }}>
          <label for={`sv-ef-${f.field}`}>
            {f.label}{#if f.required && !f.readonly}<span class="sv-ep-field__req" aria-hidden="true"> *</span>{/if}
          </label>

          {#if f.upload}
            <SvFileInput
              id={`sv-ef-${f.field}`}
              value={values[f.field]}
              accept={f.upload.accept}
              image={f.upload.image}
              disabled={f.readonly}
              upload={uploads?.[f.field]}
              onChange={(u) => (values[f.field] = u)}
            />
          {:else if depOptions}
            <div class="sv-ep-field__dropdown">
              <SvGridDropdown
                options={depOptions(values as Partial<TData>)}
                value={values[f.field]}
                autoOpen={false}
                placeholder={f.required ? 'Select…' : '—'}
                onChange={(v) => (values[f.field] = v)}
              />
            </div>
          {:else if lk}
            <SvLookupInput
              id={`sv-ef-${f.field}`}
              value={values[f.field]}
              lookup={lk}
              onSelect={(v) => (values[f.field] = v)}
              required={f.required}
              disabled={f.readonly}
              placeholder={f.placeholder ?? 'Search…'}
            />
          {:else if f.editorType === 'checkbox'}
            <!-- Boolean fields render as the suite's switch (nicer than a raw checkbox). -->
            <SvSwitchButton id={`sv-ef-${f.field}`} ariaLabel={f.label} checked={!!values[f.field]} disabled={f.readonly} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'number'}
            <SvNumberInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toNumberValue(values[f.field])} min={f.min} max={f.max} step={f.step} precision={f.precision} prefix={f.prefix} suffix={f.suffix} disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = fromNumberValue(v))} />
          {:else if f.editorType === 'color'}
            <SvColorInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] || '#3b82f6'} disabled={f.readonly} invalid={!!err} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'password'}
            <SvPasswordInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'rating' || f.editorType === 'slider'}
            {@const rmin = f.min ?? 0}
            {@const rmax = f.max ?? (f.editorType === 'rating' ? 5 : 100)}
            <SvSlider id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toSliderValue(values[f.field], rmin)} min={rmin} max={rmax} step={1} ticks={f.editorType === 'rating' ? rmax - rmin + 1 : undefined} disabled={f.readonly} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'phone'}
            <SvPhoneInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'country'}
            <SvCountryInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} disabled={f.readonly} invalid={!!err} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'mask'}
            <SvMaskedInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} mask={f.mask ?? ''} disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(masked) => (values[f.field] = masked)} />
          {:else if f.editorType === 'date'}
            <SvDateTimePicker id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" nullable disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder ?? 'yyyy-mm-dd'} onChange={(d) => (values[f.field] = toDateString(d))} />
          {:else if f.editorType === 'datetime'}
            <SvDateTimePicker id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} formatString="yyyy-MM-dd HH:mm" nullable disabled={f.readonly} invalid={!!err} required={f.required && !f.readonly} placeholder={f.placeholder ?? 'yyyy-mm-dd hh:mm'} onChange={(d) => (values[f.field] = toDateTimeString(d))} />
          {:else if f.editorType === 'chips'}
            <!-- Multi-value entry: stores a string[]. (Previously a chips field fell back to a single-select.) -->
            <SvTagsInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toTags(values[f.field])} disabled={f.readonly} invalid={!!err} placeholder={f.placeholder ?? 'Add…'} onChange={(tags) => (values[f.field] = tags)} />
          {:else if kind === 'select'}
            {#if f.readonly}
              <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="text" value={values[f.field] ?? ''} disabled />
            {:else}
              <!-- Custom dropdown: its panel portals to <body> (position:fixed),
                   so it floats above the modal and never grows the form body
                   (no scrollbar), unlike an in-flow popup. -->
              <div class="sv-ep-field__dropdown">
                <SvGridDropdown
                  options={selectOptions(f)}
                  value={values[f.field]}
                  autoOpen={false}
                  placeholder={f.required ? 'Select…' : '—'}
                  onChange={(v) => (values[f.field] = v)}
                />
              </div>
            {/if}
          {:else if kind === 'textarea'}
            <textarea id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder}></textarea>
          {:else if kind === 'number'}
            <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="number" bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder} />
          {:else if kind === 'date'}
            <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="date" bind:value={values[f.field]} disabled={f.readonly} />
          {:else if kind === 'datetime'}
            <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="datetime-local" bind:value={values[f.field]} disabled={f.readonly} />
          {:else if kind === 'time'}
            <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="time" bind:value={values[f.field]} disabled={f.readonly} />
          {:else}
            <input id={`sv-ef-${f.field}`} aria-invalid={!!err} aria-describedby={describedBy} type="text" bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder} />
          {/if}

          {#if f.help && !err}<p class="sv-ep-field__help" id={`sv-eh-${f.field}`}>{f.help}</p>{/if}
          {#if err}<p class="sv-ep-field__err" id={`sv-ee-${f.field}`}>{err}</p>{/if}
        </div>
{/snippet}

{#if open}
  {#if overlayed}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sv-ep-wrap sv-ep-wrap--{presentation}" transition:fade={{ duration: 160 }} onclick={close} role="presentation">
      {#if presentation === 'drawer'}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="sv-ep sv-ep--drawer sv-ep--sz-{formSize}" role="dialog" aria-modal="true" aria-label={heading} tabindex="-1" onclick={stop} transition:fly={{ x: 460, duration: 300, easing: cubicOut }}>
          {@render panelInner()}
        </div>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="sv-ep sv-ep--modal sv-ep--sz-{formSize}"
          class:sv-ep--floating={floating}
          data-pin={pin}
          bind:this={panelEl}
          style={panelStyle}
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          tabindex="-1"
          onclick={stop}
          transition:pop
        >
          {@render panelInner()}
          {#if floating && !maximized}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            {#if pin === 'none'}
              <div class="sv-ep__rz sv-ep__rz--e" onpointerdown={(e) => startResize(e, 'e')}></div>
              <div class="sv-ep__rz sv-ep__rz--s" onpointerdown={(e) => startResize(e, 's')}></div>
              <div class="sv-ep__rz sv-ep__rz--se" onpointerdown={(e) => startResize(e, 'se')}></div>
            {:else if pin === 'left'}
              <div class="sv-ep__rz sv-ep__rz--e" onpointerdown={(e) => startResize(e, 'e')}></div>
            {:else if pin === 'right'}
              <div class="sv-ep__rz sv-ep__rz--w" onpointerdown={(e) => startResize(e, 'w')}></div>
            {:else if pin === 'top'}
              <div class="sv-ep__rz sv-ep__rz--s" onpointerdown={(e) => startResize(e, 's')}></div>
            {:else if pin === 'bottom'}
              <div class="sv-ep__rz sv-ep__rz--n" onpointerdown={(e) => startResize(e, 'n')}></div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- The size class matters for inline too now: it fills its container by
         default, and `formSize` is what narrows it. -->
    <div class="sv-ep sv-ep--inline sv-ep--sz-{formSize}" role="dialog" aria-label={heading}>
      {@render panelInner()}
    </div>
  {/if}
{/if}

<style>
  .sv-ep,
  .sv-ep-wrap {
    --ep-bg: var(--sg-bg, #ffffff);
    --ep-fg: var(--sg-fg, #0f172a);
    --ep-muted: var(--sg-muted, #64748b);
    --ep-border: var(--sg-border, #e2e8f0);
    --ep-subtle: var(--sg-header-bg, #f8fafc);
    --ep-input-bg: var(--sg-input-bg, #ffffff);
    --ep-input-border: var(--sg-input-border, #cbd5e1);
    --ep-accent: var(--sg-accent, #2563eb);
    --ep-on-accent: var(--sg-on-accent, #ffffff);
    --ep-danger: #ef4444;
    --ep-radius: var(--sg-radius, 10px);
  }

  .sv-ep-wrap {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: flex;
    background: rgba(2, 6, 23, 0.5);
    backdrop-filter: blur(2px);
  }
  .sv-ep-wrap--drawer {
    justify-content: flex-end;
  }
  .sv-ep-wrap--modal {
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .sv-ep {
    box-sizing: border-box;
    background: var(--ep-bg);
    color: var(--ep-fg);
    font: inherit;
    font-family: var(--sg-font, inherit);
  }
  .sv-ep--drawer {
    width: min(440px, 100vw);
    height: 100%;
    border-left: 1px solid var(--ep-border);
    box-shadow: -14px 0 44px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
  }
  /* Dialog size (modal width / drawer width), unless the user has pinned/resized. */
  .sv-ep--sz-sm.sv-ep--modal { width: min(400px, 100%); }
  .sv-ep--sz-lg.sv-ep--modal { width: min(760px, 100%); }
  .sv-ep--sz-sm.sv-ep--drawer { width: min(360px, 100vw); }
  .sv-ep--sz-lg.sv-ep--drawer { width: min(600px, 100vw); }
  .sv-ep--modal {
    width: min(520px, 100%);
    max-height: 88vh;
    border: 1px solid var(--ep-border);
    border-radius: var(--ep-radius);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
  }
  /* Inline fills whatever it is placed in - a form block on a page is as wide as
     the block, and a fixed cap here made a wide block look broken. Narrow it
     with `formSize` when a full-width form is too much to read. */
  .sv-ep--inline {
    width: 100%;
    border: 1px solid var(--ep-border);
    border-radius: var(--ep-radius);
  }
  .sv-ep--sz-sm.sv-ep--inline { max-width: 460px; }
  .sv-ep--sz-lg.sv-ep--inline { max-width: 900px; }

  .sv-ep__form {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .sv-ep__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid var(--ep-border);
  }
  .sv-ep__header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
  }
  .sv-ep__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 0;
    background: none;
    color: var(--ep-muted);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    border-radius: 6px;
  }
  .sv-ep__close:hover {
    background: var(--ep-subtle);
    color: var(--ep-fg);
  }

  /* --- Floating window: drag handle, pin controls, resize handles --------- */
  .sv-ep--floating {
    position: relative; /* anchors the resize handles; inline `position:fixed` overrides once moved/pinned */
  }
  .sv-ep__header--drag {
    cursor: move;
    user-select: none;
    touch-action: none;
  }
  .sv-ep__tools {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }
  .sv-ep__pin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ep-muted);
    cursor: pointer;
    border-radius: 6px;
  }
  .sv-ep__pin:hover {
    background: var(--ep-subtle);
    color: var(--ep-fg);
  }
  .sv-ep__pin.is-active {
    color: var(--ep-accent);
    background: color-mix(in srgb, var(--ep-accent) 14%, transparent);
  }
  .sv-ep__rz {
    position: absolute;
    z-index: 5;
    touch-action: none;
  }
  .sv-ep__rz--e { top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; }
  .sv-ep__rz--w { top: 0; left: 0; width: 8px; height: 100%; cursor: ew-resize; }
  .sv-ep__rz--s { left: 0; bottom: 0; height: 8px; width: 100%; cursor: ns-resize; }
  .sv-ep__rz--n { left: 0; top: 0; height: 8px; width: 100%; cursor: ns-resize; }
  .sv-ep__rz--se { right: 0; bottom: 0; width: 15px; height: 15px; cursor: nwse-resize; }

  .sv-ep__body {
    display: grid;
    grid-template-columns: repeat(var(--sv-ep-cols, 2), minmax(0, 1fr));
    gap: 14px 16px;
    padding: 18px;
    overflow: auto;
    flex: 1; /* fill the form so a resized/pinned panel grows its scroll area */
    min-height: 0;
    align-content: start;
  }
  .sv-ep--drawer .sv-ep__body {
    grid-template-columns: 1fr;
  }
  /* Grouped layout: one scroll region holds the titled fieldsets. */
  .sv-ep__section { display: flex; flex-direction: column; }
  .sv-ep__section + .sv-ep__section { border-top: 1px solid var(--sg-border, #e6e8ec); }
  /* A section heading is a heading, not a label: it reads at the same weight as
     the dialog title, one size down. An all-caps micro-label got lost among the
     field labels, which are themselves small and muted. */
  .sv-ep__section-title { margin: 0; padding: 16px 18px 0; font-size: 13.5px; font-weight: 650; color: var(--ep-fg); }
  .sv-ep__section-desc { margin: 3px 0 0; padding: 0 18px; font-size: 12px; line-height: 1.45; color: var(--sg-muted, #64748b); }
  /* The step rail. Wraps rather than scrolls: a wizard with six steps in a
     narrow drawer should read as two rows, not run off the edge. */
  .sv-ep__steps { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 14px 18px 0; list-style: none; }
  .sv-ep__step { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-ep__step-dot { display: inline-flex; align-items: center; justify-content: center; width: 19px; height: 19px; border-radius: 50%; font-size: 10.5px; font-weight: 700; background: var(--sg-muted-bg, #eef2f7); color: var(--sg-muted, #64748b); }
  .sv-ep__step.is-current { color: var(--ep-fg); font-weight: 600; }
  .sv-ep__step.is-current .sv-ep__step-dot { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .sv-ep__step.is-done .sv-ep__step-dot { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 18%, transparent); color: var(--sg-accent, #4f46e5); }
  .sv-ep__section-toggle { display: flex; align-items: center; gap: 7px; width: 100%; padding: 0; font: inherit; text-align: left; border: 0; background: none; color: inherit; cursor: pointer; }
  .sv-ep__section-caret { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid currentColor; transition: transform 120ms ease; }
  .sv-ep__section-caret.is-shut { transform: rotate(-90deg); }
  /* How many fields are hidden in there - a folded group should not look empty. */
  .sv-ep__section-count { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 9px; font-size: 10px; font-weight: 600; background: var(--sg-muted-bg, #eef2f7); color: var(--sg-muted, #64748b); }
  /* The heading owns the gap above its fields, so the group reads as one thing. */
  .sv-ep__section-title + .sv-ep__body, .sv-ep__section-desc + .sv-ep__body { padding-top: 10px; }
  .sv-ep__discard { margin-right: auto; font-size: 12.5px; font-weight: 600; color: var(--ep-danger); }
  .sv-ep__btn--danger { border-color: var(--ep-danger); background: var(--ep-danger); color: #fff; }
  .sv-ep__section .sv-ep__body { flex: 0 0 auto; overflow: visible; }
  .sv-ep-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .sv-ep-field--wide {
    grid-column: 1 / -1;
  }
  .sv-ep-field label {
    font-size: 12px;
    font-weight: 550;
    /* The label names the thing you are about to type in, so it reads at full
       strength; muted text is for the hint underneath it. */
    color: var(--ep-fg);
  }
  .sv-ep-field--error label {
    color: var(--ep-danger);
  }
  .sv-ep-field__req {
    color: var(--ep-danger);
  }
  .sv-ep-field input,
  .sv-ep-field textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    font: inherit;
    color: var(--ep-fg);
    background: var(--ep-input-bg);
    border: 1px solid var(--ep-input-border);
    border-radius: 8px;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
  }
  .sv-ep-field input:focus,
  .sv-ep-field textarea:focus {
    outline: none;
    border-color: var(--ep-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ep-accent) 22%, transparent);
  }
  .sv-ep-field textarea {
    min-height: 76px;
    resize: vertical;
  }
  .sv-ep-field--error input,
  .sv-ep-field--error textarea,
  .sv-ep-field--error .sv-ep-field__dropdown {
    border-color: var(--ep-danger);
  }

  /* Wrapper that gives the custom dropdown an input-like frame; the dropdown
     itself fills it (its trigger is border-less) and its panel portals out. */
  .sv-ep-field__dropdown {
    position: relative;
    height: 38px;
    box-sizing: border-box;
    border: 1px solid var(--ep-input-border);
    border-radius: 8px;
    background: var(--ep-input-bg);
    transition: border-color 0.12s ease, box-shadow 0.12s ease;
  }
  .sv-ep-field__dropdown:focus-within {
    border-color: var(--ep-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ep-accent) 22%, transparent);
  }
  .sv-ep-field__dropdown :global(.sv-grid-dropdown),
  .sv-ep-field__dropdown :global(.sv-grid-dropdown-trigger) {
    background: transparent;
    color: var(--ep-fg);
    border-radius: 8px;
  }
  .sv-ep-field__dropdown :global(.sv-grid-dropdown-trigger:focus) {
    outline: none;
  }
  .sv-ep-field__help {
    margin: 0;
    font-size: 11px;
    color: var(--ep-muted);
  }
  .sv-ep-field__err {
    margin: 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--ep-danger);
  }
  .sv-ep__summary {
    margin: 0 18px 12px;
    padding: 10px 12px;
    border: 1px solid var(--ep-danger);
    border-left-width: 3px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--ep-danger) 7%, var(--sg-bg, #fff));
  }
  .sv-ep__summary-title {
    margin: 0 0 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ep-danger);
  }
  .sv-ep__summary ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sv-ep__summary li {
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
  }
  .sv-ep__summary button {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .sv-ep__submit-err {
    margin: 0;
    padding: 0 18px 4px;
    font-size: 12px;
    color: var(--ep-danger);
  }
  .sv-ep__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 18px;
    border-top: 1px solid var(--ep-border);
    background: var(--ep-subtle);
  }
  .sv-ep__btn {
    padding: 8px 16px;
    font: inherit;
    font-weight: 550;
    color: var(--ep-fg);
    background: var(--ep-bg);
    border: 1px solid var(--ep-border);
    border-radius: 8px;
    cursor: pointer;
  }
  .sv-ep__btn:hover:not(:disabled) {
    background: var(--ep-subtle);
  }
  .sv-ep__btn--primary {
    color: var(--ep-on-accent);
    background: var(--ep-accent);
    border-color: var(--ep-accent);
  }
  .sv-ep__btn--primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }
  .sv-ep__btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
