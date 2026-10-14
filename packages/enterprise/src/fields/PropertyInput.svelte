<script lang="ts">
  /**
   * One property in the field editor, drawn for its kind: a number, text, a
   * checkbox, a dropdown, a row of buttons, color swatches, icons, the select
   * options list, a default value that follows the field type, a formula, or a
   * pick of other fields.
   */
  import OptionsEditor from './OptionsEditor.svelte'
  import { FORMULA_FUNCTIONS, columnResolver, formulaError } from './formula'
  import { getFieldUsers } from './sources.svelte'
  import type { FieldEditorContext, FieldPropertyDef } from './registry.svelte'

  let {
    def,
    value,
    fieldType,
    ctx,
    onChange,
  }: { def: FieldPropertyDef; value: any; fieldType: string; ctx: FieldEditorContext; onChange: (v: unknown) => void } = $props()

  const id = $derived(`sv-fed-${def.key}`)
  const choices = $derived(
    def.kind === 'choice' ? (typeof def.choices === 'function' ? def.choices(ctx) : def.choices) : [],
  )
  // The field names a formula can use: every other field, by its header.
  const names = $derived(ctx.columns.map((c) => String(c.header ?? c.field ?? '')).filter(Boolean))
  const formulaMessage = $derived(def.kind === 'formula' && String(value ?? '').trim() ? formulaError(String(value), columnResolver(ctx.columns, ctx.self)) : null)
  const selectOptions = $derived(((ctx.props.options as Array<{ value: string }> | undefined) ?? []).map((o) => String(o.value)).filter(Boolean))
  let formulaEl = $state<HTMLTextAreaElement | null>(null)
  let showFunctions = $state(false)

  // Event readers live here: AGENTS.md keeps `as` casts in <script>.
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value
  const checkedOf = (e: Event) => (e.currentTarget as HTMLInputElement).checked
  const numberOf = (e: Event) => {
    const raw = inputValue(e)
    return raw === '' ? undefined : Number(raw)
  }

  function insertField(name: string) {
    const token = `{${name}}`
    const el = formulaEl
    const text = String(value ?? '')
    if (!el) return onChange(text + token)
    const at = el.selectionStart ?? text.length
    onChange(text.slice(0, at) + token + text.slice(el.selectionEnd ?? at))
    queueMicrotask(() => {
      el.focus()
      el.setSelectionRange(at + token.length, at + token.length)
    })
  }
  const toggleIn = (list: unknown, v: string) => {
    const arr = Array.isArray(list) ? (list as string[]) : []
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
  }
</script>

{#if def.kind === 'checkbox'}
  <label class="sv-pi-check">
    <input type="checkbox" checked={!!value} aria-describedby={def.hint ? `${id}-hint` : undefined} onchange={(e) => onChange(checkedOf(e))} />
    <span>{def.label}</span>
  </label>
  {#if def.hint}<p id={`${id}-hint`} class="sv-pi-hint sv-pi-hint-check">{def.hint}</p>{/if}
{:else if def.kind === 'options'}
  <span class="sv-pi-label">{def.label}</span>
  <OptionsEditor options={value ?? []} {onChange} />
  {#if def.hint}<p class="sv-pi-hint">{def.hint}</p>{/if}
{:else}
  <div class="sv-pi" class:is-wide={def.kind === 'formula' || def.kind === 'columns' || def.kind === 'color' || def.kind === 'icon' || (def.kind === 'default' && fieldType === 'multiSelect')}>
    <label class="sv-pi-label" for={id}>{def.label}</label>
    {#if def.kind === 'number'}
      <input {id} class="sv-pi-input sv-pi-number" type="number" min={def.min} max={def.max} value={value ?? ''} oninput={(e) => onChange(numberOf(e))} />
    {:else if def.kind === 'text'}
      <input {id} class="sv-pi-input" placeholder={def.placeholder} value={String(value ?? '')} oninput={(e) => onChange(inputValue(e))} />
    {:else if def.kind === 'choice'}
      <select {id} class="sv-pi-input sv-pi-select" value={String(value ?? '')} onchange={(e) => onChange(inputValue(e))}>
        {#if !choices.some((c) => c.value === String(value ?? ''))}<option value="" disabled>Choose...</option>{/if}
        {#each choices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
      </select>
    {:else if def.kind === 'segmented'}
      <div {id} class="sv-pi-seg" role="radiogroup" aria-label={def.label}>
        {#each def.choices as c (c.value)}
          <button type="button" role="radio" aria-checked={String(value) === c.value} class:is-on={String(value) === c.value} onclick={() => onChange(c.value)}>{c.label}</button>
        {/each}
      </div>
    {:else if def.kind === 'color'}
      <div {id} class="sv-pi-swatches" role="radiogroup" aria-label={def.label}>
        {#each def.palette as c (c.value)}
          <button type="button" role="radio" aria-checked={value === c.value} aria-label={c.label} title={c.label} class:is-on={value === c.value} style:--sw={c.value} onclick={() => onChange(c.value)}></button>
        {/each}
      </div>
    {:else if def.kind === 'icon'}
      <div {id} class="sv-pi-icons" role="radiogroup" aria-label={def.label}>
        {#each def.icons as ic (ic.value)}
          <button type="button" role="radio" aria-checked={value === ic.value} aria-label={ic.label} title={ic.label} class:is-on={value === ic.value} onclick={() => onChange(ic.value)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={ic.path} fill="none" stroke={value === ic.value ? (ctx.props.color ?? 'currentColor') : 'currentColor'} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        {/each}
      </div>
    {:else if def.kind === 'default'}
      {#if fieldType === 'checkbox'}
        <label class="sv-pi-check sv-pi-inline"><input {id} type="checkbox" checked={!!value} onchange={(e) => onChange(checkedOf(e) || undefined)} /> <span>Checked</span></label>
      {:else if fieldType === 'singleSelect'}
        <select {id} class="sv-pi-input sv-pi-select" value={String(value ?? '')} onchange={(e) => onChange(inputValue(e) || undefined)}>
          <option value="">None</option>
          {#each selectOptions as o (o)}<option value={o}>{o}</option>{/each}
        </select>
      {:else if fieldType === 'multiSelect'}
        <div {id} class="sv-pi-chips">
          {#each selectOptions as o (o)}
            <button type="button" class:is-on={Array.isArray(value) && value.includes(o)} aria-pressed={Array.isArray(value) && value.includes(o)} onclick={() => { const next = toggleIn(value, o); onChange(next.length ? next : undefined) }}>{o}</button>
          {:else}
            <span class="sv-pi-muted">Add options first.</span>
          {/each}
        </div>
      {:else if fieldType === 'user'}
        <select {id} class="sv-pi-input sv-pi-select" value={String(value ?? '')} onchange={(e) => onChange(inputValue(e) || undefined)}>
          <option value="">Nobody</option>
          {#each getFieldUsers() as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
        </select>
      {:else if fieldType === 'number' || fieldType === 'currency' || fieldType === 'percent'}
        <input {id} class="sv-pi-input sv-pi-number" type="number" value={value ?? ''} oninput={(e) => onChange(numberOf(e))} />
      {:else}
        <input {id} class="sv-pi-input" placeholder="Empty" value={String(value ?? '')} oninput={(e) => onChange(inputValue(e) || undefined)} />
      {/if}
    {:else if def.kind === 'formula'}
      <textarea
        {id}
        bind:this={formulaEl}
        class="sv-pi-input sv-pi-formula"
        rows="3"
        spellcheck="false"
        placeholder={'IF({Budget} > 2000, "Large", "Small")'}
        aria-invalid={!!formulaMessage}
        value={String(value ?? '')}
        oninput={(e) => onChange(inputValue(e))}
      ></textarea>
      {#if formulaMessage}<p class="sv-pi-error">{formulaMessage}</p>{/if}
      <div class="sv-pi-fields" aria-label="Insert a field">
        {#each names as n (n)}<button type="button" onclick={() => insertField(n)}>{n}</button>{/each}
      </div>
      <button type="button" class="sv-pi-more" aria-expanded={showFunctions} onclick={() => (showFunctions = !showFunctions)}>
        {showFunctions ? 'Hide functions' : 'Functions'}
      </button>
      {#if showFunctions}<p class="sv-pi-functions">{FORMULA_FUNCTIONS.join(', ')}</p>{/if}
    {:else if def.kind === 'columns'}
      <div {id} class="sv-pi-chips">
        {#each ctx.columns as c (String(c.id ?? c.field))}
          {@const cid = String(c.id ?? c.field)}
          <button type="button" class:is-on={Array.isArray(value) && value.includes(cid)} aria-pressed={Array.isArray(value) && value.includes(cid)} onclick={() => onChange(toggleIn(value, cid))}>{String(c.header ?? cid)}</button>
        {/each}
      </div>
    {/if}
    {#if def.hint}<p class="sv-pi-hint">{def.hint}</p>{/if}
  </div>
{/if}

<style>
  .sv-pi { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px 12px; }
  .sv-pi.is-wide { grid-template-columns: 1fr; }
  .sv-pi-hint, .sv-pi-error, .sv-pi-functions { grid-column: 1 / -1; margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-pi-error { color: var(--sg-danger, #dc2626); }
  /* Under the checkbox's label, past the box and the gap. */
  .sv-pi-hint-check { margin-top: -4px; padding-inline-start: 23px; }
  .sv-pi-functions { font-family: ui-monospace, monospace; line-height: 1.5; }
  .sv-pi-label { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .sv-pi-muted { font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-pi-input {
    box-sizing: border-box; height: 32px; padding: 0 10px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-pi-input:focus { outline: none; border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent); }
  .sv-pi-input[aria-invalid='true'] { border-color: var(--sg-danger, #dc2626); }
  .sv-pi-number { width: 110px; }
  .sv-pi-select { min-width: 170px; max-width: 240px; }
  .sv-pi-formula { height: auto; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.45; resize: vertical; }
  .sv-pi-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--sg-fg, #0f172a); cursor: pointer; }
  .sv-pi-check input { width: 15px; height: 15px; accent-color: var(--sg-accent, #2563eb); }
  .sv-pi-seg { display: inline-flex; padding: 2px; border-radius: var(--sg-radius, 6px); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); }
  .sv-pi-seg button { height: 26px; padding: 0 10px; border: 0; border-radius: 4px; background: none; color: var(--sg-muted, #64748b); font: inherit; font-size: 12px; cursor: pointer; }
  .sv-pi-seg button.is-on { background: var(--sg-selection-bg, #eef4ff); color: var(--sg-fg, #0f172a); font-weight: 500; }
  .sv-pi-swatches, .sv-pi-icons, .sv-pi-chips, .sv-pi-fields { display: flex; flex-wrap: wrap; gap: 6px; }
  .sv-pi-swatches button {
    width: 22px; height: 22px; padding: 0; border-radius: 999px; cursor: pointer; background: var(--sw);
    border: 2px solid var(--sg-bg, #fff); box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0);
  }
  .sv-pi-swatches button.is-on { box-shadow: 0 0 0 2px var(--sg-fg, #0f172a); }
  .sv-pi-icons button {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 30px; padding: 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); background: var(--sg-bg, #fff); color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-pi-icons button.is-on { border-color: var(--sg-accent, #2563eb); background: var(--sg-selection-bg, #eef4ff); color: var(--sg-fg, #0f172a); }
  .sv-pi-chips button, .sv-pi-fields button {
    height: 24px; padding: 0 9px; border-radius: 999px; font: inherit; font-size: 12px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-pi-chips button.is-on { border-color: var(--sg-accent, #2563eb); background: var(--sg-selection-bg, #eef4ff); }
  .sv-pi-fields button { font-family: ui-monospace, monospace; font-size: 11px; }
  .sv-pi-fields button::before { content: '{'; color: var(--sg-muted, #64748b); }
  .sv-pi-fields button::after { content: '}'; color: var(--sg-muted, #64748b); }
  .sv-pi-more { justify-self: start; padding: 0; border: 0; background: none; color: var(--sg-muted, #64748b); font: inherit; font-size: 12px; text-decoration: underline; cursor: pointer; }
  .sv-pi-swatches button:focus-visible, .sv-pi-icons button:focus-visible, .sv-pi-seg button:focus-visible, .sv-pi-chips button:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
</style>
