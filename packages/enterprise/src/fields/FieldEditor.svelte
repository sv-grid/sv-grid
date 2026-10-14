<script lang="ts">
  /**
   * The field editor: name, type, the type's properties, a description. Adds
   * a field (column adder, Insert left / right) or edits one (Edit field). On a
   * type change it says how many cells would be cleared before applying.
   */
  import { SvModal } from '@svgrid/grid'
  import PropertyInput from './PropertyInput.svelte'
  import { listFieldTypes, getFieldType, originalColumn, type FieldEditorContext } from './registry.svelte'
  import { addField, defId, nameTaken, plainDef, previewChange, updateField } from './field-ops'
  import { columnResolver, formulaError } from './formula'

  let {
    ctrl,
    mode,
    columnId,
    index = 'end',
    onClose,
  }: {
    ctrl: any
    mode: 'add' | 'edit'
    columnId?: string
    index?: number | 'end'
    onClose: () => void
  } = $props()

  // svelte-ignore state_referenced_locally
  const existing = mode === 'edit' && columnId ? ctrl.internalColumns.find((d: any) => defId(d) === columnId) : null
  // svelte-ignore state_referenced_locally
  const plain = existing ? plainDef(existing) : null

  const allowed = $derived.by(() => {
    const cfg = ctrl.props.columnAdder
    const ids = cfg && typeof cfg === 'object' && Array.isArray(cfg.types) ? (cfg.types as string[]) : null
    const types = listFieldTypes()
    return ids ? ids.map((id) => types.find((t) => t.id === id)).filter((t) => !!t) : types.filter((t) => !t.editAs)
  })

  // A currency or percent column opens as a number field in that format.
  // svelte-ignore state_referenced_locally
  const alias = getFieldType(plain?.fieldType)?.editAs
  let name = $state(String(plain?.header ?? ''))
  let fieldType = $state(alias?.type ?? String(plain?.fieldType ?? 'text'))
  let props = $state<Record<string, any>>({ ...((plain?.fieldProps as Record<string, unknown>) ?? {}), ...(alias?.props ?? {}) })
  let description = $state(String(plain?.description ?? ''))
  let search = $state('')
  // The type list is open while choosing (a new field starts there) and folds
  // into a selector once a type is picked, so its options sit near the top.
  // svelte-ignore state_referenced_locally
  let pickerOpen = $state(mode === 'add')
  let open = $state(true)

  const type = $derived(getFieldType(fieldType))
  const shownTypes = $derived(allowed.filter((t) => !search || t.label.toLowerCase().includes(search.toLowerCase())))
  // A field left unnamed is named after its type, numbered when taken
  // ("Number", "Number 2"); an edited field keeps needing a name.
  const fallbackName = $derived.by(() => {
    const base = type?.label ?? 'Field'
    let n = base
    for (let i = 2; nameTaken(ctrl, n, columnId); i++) n = `${base} ${i}`
    return n
  })
  const finalName = $derived(name.trim() || (mode === 'add' ? fallbackName : ''))
  const nameError = $derived(!finalName ? 'A field needs a name' : nameTaken(ctrl, finalName, columnId) ? 'Another field has this name' : null)
  const cleared = $derived(mode === 'edit' && columnId ? previewChange(ctrl, columnId, { name, fieldType, fieldProps: props }) : 0)
  // The stored type: what updateField converts from on save, alias or not.
  const fromType = plain?.fieldType ? String(plain.fieldType) : undefined
  // An alias opened as its target (Currency as Number) converts on save too;
  // say so only when that clears cells, or the type was changed on purpose.
  const warn = $derived(mode === 'edit' && !!fromType && fromType !== fieldType && (fieldType !== alias?.type || cleared > 0))

  // Event readers live here, not in the markup: AGENTS.md keeps `as` casts in <script>.
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value

  function pickType(id: string) {
    if (id === fieldType) return
    fieldType = id
    pickerOpen = false
    search = ''
    // Keep only the properties the new type has, starting from its defaults.
    const next = getFieldType(id)
    const keep: Record<string, any> = { ...(next?.defaults ?? {}) }
    for (const p of next?.properties ?? []) if (props[p.key] !== undefined) keep[p.key] = props[p.key]
    props = keep
  }

  // What a property's dynamic choices and the formula see: the draft and every other field.
  const editorCtx = $derived<FieldEditorContext>({
    ctrl,
    props: { ...(type?.defaults ?? {}), ...props },
    columns: (ctrl.internalColumns as Array<Record<string, any>>).map((c) => originalColumn(c)).filter((c) => defId(c) !== columnId),
    // A formula may not read its own field, by any of its names.
    self: [plain?.field, columnId, plain?.header, finalName],
  })
  const shownProps = $derived((type?.properties ?? []).filter((p) => !p.visible || p.visible(editorCtx.props)))
  // A formula that does not compile cannot be saved; the box shows why. An
  // empty one can: its cells stay empty until it is written.
  const formulaProblem = $derived.by(() => {
    for (const p of shownProps) {
      if (p.kind !== 'formula') continue
      const src = String(editorCtx.props[p.key] ?? '')
      const message = src.trim() ? formulaError(src, columnResolver(editorCtx.columns, editorCtx.self)) : null
      if (message) return message
    }
    return null
  })
  // Every group a type may name; an empty one is not drawn.
  const GROUPS = [
    { id: 'basic', label: 'Fields' },
    { id: 'number', label: 'Numbers and time' },
    { id: 'date', label: 'Dates' },
    { id: 'people', label: 'People' },
    { id: 'computed', label: 'Computed and automatic' },
    { id: 'relation', label: 'Other tables' },
  ] as const
  // A group the list does not know (a typo in a registered type) shows under Fields.
  const groupOf = (t: { group?: string }) => (GROUPS.some((g) => g.id === t.group) ? t.group : 'basic')
  const grouped = $derived(
    GROUPS.map((g) => ({ ...g, types: shownTypes.filter((t) => groupOf(t) === g.id) })).filter((g) => g.types.length),
  )

  function save() {
    if (nameError || formulaProblem) return
    const draft = { name: finalName, fieldType, fieldProps: $state.snapshot(props), description }
    if (mode === 'edit' && columnId) updateField(ctrl, columnId, draft)
    else addField(ctrl, draft, index)
    close()
  }

  function close() {
    open = false
    onClose()
  }
</script>

<SvModal bind:open title={mode === 'edit' ? 'Edit field' : 'Add field'} width={500} onClose={close}>
  <form class="sv-fed" onsubmit={(e) => { e.preventDefault(); save() }}>
    <div class="sv-fed-group">
      <label class="sv-fed-label" for="sv-fed-name">Name</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="sv-fed-name"
        class="sv-fed-input"
        placeholder={mode === 'add' ? fallbackName : 'Field name'}
        bind:value={name}
        autofocus
        autocomplete="off"
        aria-invalid={!!nameError && name.length > 0}
        aria-describedby="sv-fed-name-error"
      />
      {#if nameError && name.length > 0}<p id="sv-fed-name-error" class="sv-fed-error">{nameError}</p>{/if}
    </div>

    <div class="sv-fed-group">
      <span class="sv-fed-label" id="sv-fed-type-label">Field type</span>
      {#if !pickerOpen}
        <button type="button" class="sv-fed-current" aria-expanded="false" aria-labelledby="sv-fed-type-label" onclick={() => (pickerOpen = true)}>
          <span class="sv-fed-type-icon" aria-hidden="true">
            {#if type?.icon}<svg viewBox="0 0 24 24" width="14" height="14"><path d={type.icon} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
          </span>
          <span class="sv-fed-type-label">{type?.label ?? fieldType}</span>
          <svg class="sv-fed-chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      {:else}
      {#if allowed.length > 8}
        <div class="sv-fed-search">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          <input class="sv-fed-input" placeholder="Find a type" aria-label="Find a field type" bind:value={search} />
        </div>
      {/if}
      <div class="sv-fed-types-scroll" role="radiogroup" aria-labelledby="sv-fed-type-label">
        {#each grouped as g (g.id)}
          <div class="sv-fed-type-group">{g.label}</div>
          <div class="sv-fed-types">
            {#each g.types as t (t.id)}
              <button
                type="button"
                class="sv-fed-type"
                class:is-on={t.id === fieldType}
                role="radio"
                aria-checked={t.id === fieldType}
                onclick={() => pickType(t.id)}
              >
                <span class="sv-fed-type-icon" aria-hidden="true">
                  {#if t.icon}
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d={t.icon} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  {/if}
                </span>
                <span class="sv-fed-type-label">{t.label}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="sv-fed-none">No type matches "{search}".</p>
        {/each}
      </div>
      {/if}
      {#if type?.description}<p class="sv-fed-hint-line">{type.description}</p>{/if}
    </div>

    {#if shownProps.length}
      <div class="sv-fed-group sv-fed-props">
        {#each shownProps as p (p.key)}
          <PropertyInput
            def={p}
            value={props[p.key] ?? type?.defaults?.[p.key]}
            {fieldType}
            ctx={editorCtx}
            onChange={(v) => (props = { ...props, [p.key]: v, ...(p.alsoSets?.(v, editorCtx.props) ?? {}) })}
          />
        {/each}
      </div>
    {/if}

    <div class="sv-fed-group">
      <label class="sv-fed-label" for="sv-fed-desc">Description <span class="sv-fed-optional">optional</span></label>
      <textarea id="sv-fed-desc" class="sv-fed-input sv-fed-desc" rows="2" placeholder="What goes in this field" bind:value={description}></textarea>
    </div>

    {#if warn && fromType}
      <p class="sv-fed-warning" role="status">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 4 2.5 20h19zM12 10v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>
          {getFieldType(fromType)?.label ?? fromType} to {type?.label ?? fieldType} converts the values.
          {cleared === 0 ? 'Every value converts.' : `${cleared} cell${cleared === 1 ? '' : 's'} will be cleared or cut short.`}
        </span>
      </p>
    {/if}
  </form>
  {#snippet footer()}
    <div class="sv-fed-footer">
      <button type="button" class="sv-fed-btn" onclick={close}>Cancel</button>
      <button type="button" class="sv-fed-btn is-primary" disabled={!!nameError || !!formulaProblem} title={formulaProblem ? `Fix the formula first: ${formulaProblem}` : undefined} onclick={save}>
        {mode === 'edit' ? 'Save' : 'Create field'}
      </button>
    </div>
  {/snippet}
</SvModal>

<style>
  /* Only tokens every theme defines (bg, fg, border, muted, header-bg,
     row-hover-bg, input-bg, input-border, accent, selection-bg, radius): the
     dialog renders under <body>, outside the grid, and a missing token falls
     back to its light default even in a dark theme. */
  .sv-fed { display: flex; flex-direction: column; gap: 18px; }
  .sv-fed-group { display: flex; flex-direction: column; gap: 6px; }
  .sv-fed-props {
    gap: 10px; padding: 12px; border-radius: var(--sg-radius, 6px);
    background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-fed-label { font-size: 12px; font-weight: 600; color: var(--sg-fg, #0f172a); }
  .sv-fed-optional { font-weight: 400; color: var(--sg-muted, #64748b); }
  .sv-fed-input {
    width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; font: inherit; font-size: 14px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .sv-fed-input::placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-fed-input:focus { outline: none; border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent); }
  .sv-fed-input[aria-invalid='true'] { border-color: var(--sg-danger, #dc2626); }
  .sv-fed-desc { height: auto; min-height: 58px; padding: 8px 10px; resize: vertical; line-height: 1.4; }
  .sv-fed-error { margin: 0; font-size: 12px; color: var(--sg-danger, #dc2626); }
  .sv-fed-search { position: relative; display: flex; align-items: center; color: var(--sg-muted, #64748b); }
  .sv-fed-search svg { position: absolute; inset-inline-start: 10px; pointer-events: none; }
  .sv-fed-search .sv-fed-input { height: 30px; padding-inline-start: 30px; font-size: 13px; }
  .sv-fed-current {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 38px; padding: 0 10px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a); font: inherit; font-size: 14px; text-align: start; cursor: pointer;
  }
  .sv-fed-current:hover { border-color: var(--sg-muted, #94a3b8); }
  .sv-fed-current:focus-visible { outline: none; border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent); }
  .sv-fed-current .sv-fed-type-label { flex: 1; }
  .sv-fed-chevron { flex: none; color: var(--sg-muted, #64748b); }
  .sv-fed-types-scroll { max-height: 300px; overflow: auto; margin-top: 2px; padding-inline-end: 2px; }
  .sv-fed-types { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; }
  .sv-fed-type-group {
    margin: 10px 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .sv-fed-type-group:first-child { margin-top: 2px; }
  .sv-fed-type {
    display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 8px;
    border: 1px solid transparent; border-radius: var(--sg-radius, 6px); background: none;
    color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; text-align: start; cursor: pointer;
  }
  .sv-fed-type:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fed-type.is-on { background: var(--sg-selection-bg, #eef4ff); border-color: var(--sg-accent, #2563eb); }
  .sv-fed-type:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
  .sv-fed-type-icon {
    flex: none; display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 6px;
    background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0);
    color: var(--sg-muted, #64748b);
  }
  .sv-fed-type.is-on .sv-fed-type-icon { color: var(--sg-accent, #2563eb); border-color: color-mix(in srgb, var(--sg-accent, #2563eb) 40%, transparent); }
  .sv-fed-type-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-fed-none { grid-column: 1 / -1; margin: 8px 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-fed-hint-line { margin: 2px 0 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-fed-warning {
    display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px;
    border-radius: var(--sg-radius, 6px); font-size: 13px; line-height: 1.4; color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-warning, #f59e0b) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--sg-warning, #f59e0b) 35%, transparent);
  }
  .sv-fed-warning svg { flex: none; margin-top: 1px; color: var(--sg-warning, #d97706); }
  .sv-fed-footer { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .sv-fed-btn {
    height: 34px; padding: 0 16px; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-fed-btn:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fed-btn:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  /* Primary is the inverted pair (fg on bg), not the accent: on Ember the
     accent means selection and focus. */
  .sv-fed-btn.is-primary { background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); border-color: var(--sg-fg, #0f172a); }
  .sv-fed-btn.is-primary:hover { opacity: 0.9; }
  .sv-fed-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
