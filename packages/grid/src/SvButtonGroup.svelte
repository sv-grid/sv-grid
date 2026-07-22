<script lang="ts" module>
  export type { ButtonGroupItem, ButtonGroupMode, ButtonGroupValue } from './createButtonGroup.svelte'
</script>

<script lang="ts">
  /**
   * SvButtonGroup - a segmented button bar with single-select (radio semantics),
   * multi-select (toggle set) or plain action buttons. Parity: Smart
   * `smart-button-group`. Controlled via `value` + `onChange`; roving tabindex +
   * arrow-key navigation come from the headless `createButtonGroup` core.
   *
   * Part of the editor kit: carries the shared contract (label, hint, error
   * validation, size, `dir`/RTL) via `<SvField>`.
   */
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createButtonGroup, type ButtonGroupItem, type ButtonGroupMode, type ButtonGroupValue } from './createButtonGroup.svelte'

  type Props = SvEditorProps & {
    items: ReadonlyArray<ButtonGroupItem>
    value?: ButtonGroupValue
    onChange?: (value: string | number | Array<string | number>) => void
    /** 'single' (radio), 'multiple' (toggle set), or 'none' (action buttons). */
    mode?: ButtonGroupMode
    orientation?: 'horizontal' | 'vertical'
    /** 'solid' segmented fill (default) or 'outline' pills. */
    variant?: 'solid' | 'outline'
  }

  let {
    items,
    value = null,
    onChange,
    mode = 'single',
    orientation = 'horizontal',
    variant = 'solid',
    disabled = false,
    size = 'md',
    name,
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
  }: Props = $props()

  const autoId = nextEditorId('sv-bg')
  const uid = $derived(id ?? autoId)

  const g = createButtonGroup({
    items: () => items,
    value: () => value,
    onChange: (v) => onChange?.(v),
    mode: () => mode,
    orientation: () => orientation,
    disabled: () => disabled,
    dir: () => dir,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel ?? label,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div
    class="sv-bg sv-bg--{orientation} sv-bg--{variant} sv-bg--{size}"
    class:is-disabled={disabled}
    class:is-invalid={invalid}
    {...g.rootProps()}
  >
    {#each items as item, i (item.value)}
      <button
        class="sv-bg__btn"
        class:is-selected={g.isSelected(item.value)}
        {...g.buttonProps(i)}
      >{item.label ?? item.value}</button>
    {/each}
    {#if name}
      {#each g.selectedValues as v (v)}<input type="hidden" {name} value={v} />{/each}
    {/if}
  </div>
</SvField>

<style>
  .sv-bg {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-input-border, var(--sg-border, #cbd5e1));
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; background: var(--sg-input-bg, #fff);
    border: 1px solid var(--_border); border-radius: var(--_radius); overflow: hidden;
  }
  .sv-bg--vertical { flex-direction: column; }
  .sv-bg.is-disabled { opacity: 0.6; }
  .sv-bg.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-bg:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-bg.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }

  .sv-bg__btn {
    background: none; border: 0; font: inherit; font-weight: 600; color: var(--sg-fg, #0f172a);
    cursor: pointer; white-space: nowrap; transition: background 0.12s, color 0.12s;
  }
  .sv-bg--sm .sv-bg__btn { padding: 5px 11px; font-size: 12px; }
  .sv-bg--md .sv-bg__btn { padding: 7px 14px; font-size: 13px; }
  .sv-bg--lg .sv-bg__btn { padding: 10px 18px; font-size: 15px; }
  /* Segment dividers use a logical border so the bar mirrors under RTL. */
  .sv-bg--horizontal .sv-bg__btn + .sv-bg__btn { border-inline-start: 1px solid var(--_border); }
  .sv-bg--vertical .sv-bg__btn + .sv-bg__btn { border-top: 1px solid var(--_border); }
  .sv-bg__btn:hover:not(:disabled):not(.is-selected) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-bg__btn:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; }
  .sv-bg__btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .sv-bg--solid .sv-bg__btn.is-selected { background: var(--_accent); color: var(--sg-on-accent, #fff); }
  .sv-bg--solid .sv-bg__btn.is-selected + .sv-bg__btn, .sv-bg--solid .sv-bg__btn.is-selected { border-color: var(--_accent); }
  .sv-bg--outline .sv-bg__btn.is-selected { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 12%, transparent); }
</style>
