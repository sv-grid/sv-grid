<script lang="ts">
  /**
   * The select options list in the field editor: a color and a name per
   * option, reorder with the arrows, remove, add, sort A to Z. A swatch opens
   * the 40-color palette (ten hues, four strengths) under its option.
   */
  import { OPTION_COLORS, OPTION_CYCLE } from './palette'

  type Option = { value: string; color?: string }
  let { options, onChange }: { options: Option[]; onChange: (next: Option[]) => void } = $props()
  let paletteFor = $state<number | null>(null)

  // Kept out of the markup: AGENTS.md keeps `as` casts in <script>.
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value

  function set(i: number, patch: Partial<Option>) {
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  }
  function move(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= options.length) return
    const next = options.slice()
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  function add() {
    onChange([...options, { value: '', color: OPTION_CYCLE[options.length % OPTION_CYCLE.length] }])
    queueMicrotask(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.sv-fopt-name')
      inputs[inputs.length - 1]?.focus()
    })
  }
  function sortAZ() {
    onChange(options.slice().sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base', numeric: true })))
  }
</script>

<ul class="sv-fopt" aria-label="Options">
  {#each options as o, i (i)}
    <li class="sv-fopt-row">
      <button
        type="button"
        class="sv-fopt-swatch"
        style:background={o.color ?? '#cccccc'}
        aria-label={`Color of ${o.value || 'option ' + (i + 1)}`}
        aria-expanded={paletteFor === i}
        onclick={() => (paletteFor = paletteFor === i ? null : i)}
      ></button>
      <input
        class="sv-fopt-name"
        value={o.value}
        placeholder="Option name"
        aria-label={`Option ${i + 1}`}
        oninput={(e) => set(i, { value: inputValue(e) })}
      />
      <button type="button" class="sv-fopt-icon" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="sv-fopt-icon" aria-label="Move down" disabled={i === options.length - 1} onclick={() => move(i, 1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
      <button type="button" class="sv-fopt-icon" aria-label={`Remove ${o.value || 'option'}`} onclick={() => onChange(options.filter((_, j) => j !== i))}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </li>
    {#if paletteFor === i}
      <li><div class="sv-fopt-palette" role="radiogroup" aria-label={`Color of ${o.value || 'option ' + (i + 1)}`}>
        {#each OPTION_COLORS as c (c.value)}
          <button
            type="button"
            role="radio"
            aria-checked={o.color === c.value}
            aria-label={c.label}
            title={c.label}
            class:is-on={o.color === c.value}
            style:background={c.value}
            onclick={() => {
              set(i, { color: c.value })
              paletteFor = null
            }}
          ></button>
        {/each}
      </div></li>
    {/if}
  {/each}
</ul>
<div class="sv-fopt-actions">
  <button type="button" class="sv-fopt-add" onclick={add}>+ Add option</button>
  {#if options.length > 1}<button type="button" class="sv-fopt-add" onclick={sortAZ}>Sort A to Z</button>{/if}
</div>

<style>
  .sv-fopt { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow: auto; }
  .sv-fopt-row { display: flex; align-items: center; gap: 6px; }
  .sv-fopt-swatch { flex: none; width: 18px; height: 18px; border-radius: 999px; border: 2px solid var(--sg-bg, #fff); box-shadow: 0 0 0 1px var(--sg-border, #e2e8f0); cursor: pointer; }
  .sv-fopt-swatch:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .sv-fopt-name {
    flex: 1; min-width: 0; height: 30px; padding: 0 8px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-fopt-name::placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-fopt-name:focus { outline: none; border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent); }
  .sv-fopt-icon { flex: none; display: inline-flex; padding: 4px; border: 0; border-radius: 4px; background: none; color: var(--sg-muted, #64748b); cursor: pointer; }
  .sv-fopt-icon:disabled { opacity: 0.35; cursor: default; }
  .sv-fopt-icon:not(:disabled):hover { color: var(--sg-fg, #0f172a); }
  .sv-fopt-palette {
    display: grid; grid-template-columns: repeat(10, 20px); gap: 5px; padding: 8px; margin-inline-start: 24px;
    border-radius: var(--sg-radius, 6px); border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff); width: max-content;
  }
  .sv-fopt-palette button { width: 20px; height: 20px; padding: 0; border-radius: 4px; border: 0; cursor: pointer; }
  .sv-fopt-palette button.is-on { box-shadow: 0 0 0 2px var(--sg-bg, #fff), 0 0 0 4px var(--sg-fg, #0f172a); }
  .sv-fopt-palette button:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 2px; }
  .sv-fopt-actions { display: flex; gap: 14px; margin-top: 6px; }
  .sv-fopt-add { padding: 4px 0; border: 0; background: none; color: var(--sg-muted, #64748b); font: inherit; font-size: 13px; cursor: pointer; }
  .sv-fopt-add:hover { color: var(--sg-fg, #0f172a); }
</style>
