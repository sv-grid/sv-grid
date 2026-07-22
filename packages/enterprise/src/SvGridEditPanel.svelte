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
  import { schemaToFormFields, type EntitySchema, type FormFieldDescriptor } from './schema'
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
    type EditMode,
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
    onSubmit,
    onCancel,
  }: Props = $props()

  const fields = $derived(schemaToFormFields(schema))

  // Options for the custom dropdown: prepend a blank "clear" option for
  // non-required fields (parity with the native select's empty option).
  const selectOptions = (f: FormFieldDescriptor) =>
    f.required ? (f.options ?? []) : [{ value: '', label: '—' }, ...(f.options ?? [])]
  const mode = $derived(editMode(row))
  const heading = $derived(
    title ?? `${mode === 'create' ? 'New' : 'Edit'} ${schema.label ?? schema.name}`,
  )
  const overlayed = $derived(presentation !== 'inline')

  let values = $state<Record<string, any>>({})
  let errors = $state<Record<string, string>>({})
  let submitting = $state(false)
  let submitError = $state<string | null>(null)

  $effect(() => {
    values = buildInitialValues(schema, row)
    errors = {}
    submitError = null
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    submitError = null
    const found = await validateAll(schema, values)
    errors = found
    if (Object.keys(found).length > 0) return
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

  function close() {
    onCancel?.()
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onCancel) close()
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

    <div class="sv-ep__body">
      {#each fields as f (f.field)}
        {@const kind = controlKind(f)}
        {@const lk = f.relation ? lookups?.[f.field] : undefined}
        {@const depOptions = dependentOptions?.[f.field]}
        <div class="sv-ep-field" class:sv-ep-field--wide={f.span === 2} class:sv-ep-field--error={!!errors[f.field]}>
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
            <SvNumberInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toNumberValue(values[f.field])} min={f.min} max={f.max} step={f.step} precision={f.precision} prefix={f.prefix} suffix={f.suffix} disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = fromNumberValue(v))} />
          {:else if f.editorType === 'color'}
            <SvColorInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] || '#3b82f6'} disabled={f.readonly} invalid={!!errors[f.field]} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'password'}
            <SvPasswordInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'rating' || f.editorType === 'slider'}
            {@const rmin = f.min ?? 0}
            {@const rmax = f.max ?? (f.editorType === 'rating' ? 5 : 100)}
            <SvSlider id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toSliderValue(values[f.field], rmin)} min={rmin} max={rmax} step={1} ticks={f.editorType === 'rating' ? rmax - rmin + 1 : undefined} disabled={f.readonly} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'phone'}
            <SvPhoneInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'country'}
            <SvCountryInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} disabled={f.readonly} invalid={!!errors[f.field]} placeholder={f.placeholder} onChange={(v) => (values[f.field] = v)} />
          {:else if f.editorType === 'mask'}
            <SvMaskedInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? ''} mask={f.mask ?? ''} disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder} onChange={(masked) => (values[f.field] = masked)} />
          {:else if f.editorType === 'date'}
            <SvDateTimePicker id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} dropDownDisplayMode="calendar" formatString="yyyy-MM-dd" nullable disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder ?? 'yyyy-mm-dd'} onChange={(d) => (values[f.field] = toDateString(d))} />
          {:else if f.editorType === 'datetime'}
            <SvDateTimePicker id={`sv-ef-${f.field}`} ariaLabel={f.label} value={values[f.field] ?? null} formatString="yyyy-MM-dd HH:mm" nullable disabled={f.readonly} invalid={!!errors[f.field]} required={f.required && !f.readonly} placeholder={f.placeholder ?? 'yyyy-mm-dd hh:mm'} onChange={(d) => (values[f.field] = toDateTimeString(d))} />
          {:else if f.editorType === 'chips'}
            <!-- Multi-value entry: stores a string[]. (Previously a chips field fell back to a single-select.) -->
            <SvTagsInput id={`sv-ef-${f.field}`} ariaLabel={f.label} value={toTags(values[f.field])} disabled={f.readonly} invalid={!!errors[f.field]} placeholder={f.placeholder ?? 'Add…'} onChange={(tags) => (values[f.field] = tags)} />
          {:else if kind === 'select'}
            {#if f.readonly}
              <input id={`sv-ef-${f.field}`} type="text" value={values[f.field] ?? ''} disabled />
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
            <textarea id={`sv-ef-${f.field}`} bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder}></textarea>
          {:else if kind === 'number'}
            <input id={`sv-ef-${f.field}`} type="number" bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder} />
          {:else if kind === 'date'}
            <input id={`sv-ef-${f.field}`} type="date" bind:value={values[f.field]} disabled={f.readonly} />
          {:else if kind === 'datetime'}
            <input id={`sv-ef-${f.field}`} type="datetime-local" bind:value={values[f.field]} disabled={f.readonly} />
          {:else if kind === 'time'}
            <input id={`sv-ef-${f.field}`} type="time" bind:value={values[f.field]} disabled={f.readonly} />
          {:else}
            <input id={`sv-ef-${f.field}`} type="text" bind:value={values[f.field]} disabled={f.readonly} placeholder={f.placeholder} />
          {/if}

          {#if f.help && !errors[f.field]}<p class="sv-ep-field__help">{f.help}</p>{/if}
          {#if errors[f.field]}<p class="sv-ep-field__err">{errors[f.field]}</p>{/if}
        </div>
      {/each}
    </div>

    {#if submitError}<p class="sv-ep__submit-err" role="alert">{submitError}</p>{/if}

    <footer class="sv-ep__footer">
      {#if onCancel}
        <button type="button" class="sv-ep__btn" onclick={close} disabled={submitting}>Cancel</button>
      {/if}
      <button type="submit" class="sv-ep__btn sv-ep__btn--primary" disabled={submitting}>
        {submitting ? 'Saving…' : (submitLabel ?? (mode === 'create' ? 'Create' : 'Save'))}
      </button>
    </footer>
  </form>
{/snippet}

{#if open}
  {#if overlayed}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sv-ep-wrap sv-ep-wrap--{presentation}" transition:fade={{ duration: 160 }} onclick={close} role="presentation">
      {#if presentation === 'drawer'}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="sv-ep sv-ep--drawer" role="dialog" aria-modal="true" aria-label={heading} tabindex="-1" onclick={stop} transition:fly={{ x: 460, duration: 300, easing: cubicOut }}>
          {@render panelInner()}
        </div>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="sv-ep sv-ep--modal"
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
    <div class="sv-ep sv-ep--inline" role="dialog" aria-label={heading}>
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
  }
  .sv-ep--drawer {
    width: min(440px, 100vw);
    height: 100%;
    border-left: 1px solid var(--ep-border);
    box-shadow: -14px 0 44px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
  }
  .sv-ep--modal {
    width: min(520px, 100%);
    max-height: 88vh;
    border: 1px solid var(--ep-border);
    border-radius: var(--ep-radius);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
  }
  .sv-ep--inline {
    width: 100%;
    max-width: 460px;
    border: 1px solid var(--ep-border);
    border-radius: var(--ep-radius);
  }

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
    grid-template-columns: 1fr 1fr;
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
    color: var(--ep-muted);
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
