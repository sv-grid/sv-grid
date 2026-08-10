<script lang="ts" module>
  export type { RadioOption as SegmentedOption } from './createRadioGroup.svelte'
</script>

<script lang="ts">
  /**
   * SvSegmented - a segmented control: a compact row of mutually-exclusive
   * options in a shared track (the modern alternative to a small radio group or a
   * tab strip for a setting). Single-select, keyboard-accessible (it reuses the
   * radio-group core: arrow keys roam, Space/Enter select), and themed from the
   * shared `--sg-*` tokens.
   *
   * ```svelte
   * <SvSegmented options={[{value:'list',label:'List'},{value:'grid',label:'Grid'}]} bind:value />
   * ```
   */
  import type { Snippet } from 'svelte'
  import SvField from './SvField.svelte'
  import { createRadioGroup, type RadioOption } from './createRadioGroup.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'

  type SegOption = RadioOption & { icon?: Snippet }

  type Props = Pick<
    SvEditorProps,
    'disabled' | 'size' | 'dir' | 'id' | 'ariaLabel' | 'label' | 'hint' | 'error' | 'required' | 'invalid'
  > & {
    options: ReadonlyArray<SegOption>
    value?: string | number | null
    onChange?: (value: string | number) => void
    /** Stretch the control (and split options evenly) to the container width. */
    block?: boolean
    name?: string
  }

  let {
    options,
    value = $bindable<string | number | null>(null),
    onChange,
    disabled = false,
    size = 'md',
    dir,
    id,
    ariaLabel,
    label,
    hint,
    error,
    required = false,
    invalid = false,
    block = false,
    name,
  }: Props = $props()

  const autoId = nextEditorId('sv-seg')
  const uid = $derived(id ?? autoId)

  const rg = createRadioGroup({
    options: () => options,
    value: () => value,
    onChange: (v) => { value = v; onChange?.(v) },
    disabled: () => disabled,
    ariaLabel: () => ariaLabel ?? label,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-seg sv-seg--{size}" class:is-block={block} class:is-disabled={disabled} class:is-invalid={invalid} {...rg.groupProps()}>
    {#each options as opt (opt.value)}
      <button
        class="sv-seg__opt"
        class:is-selected={rg.isChecked(opt)}
        {...rg.radioProps(opt)}
      >
        {#if opt.icon}<span class="sv-seg__icon">{@render opt.icon()}</span>{/if}
        <span class="sv-seg__label">{opt.label}</span>
      </button>
    {/each}
    {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  </div>
</SvField>

<style>
  .sv-seg {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; gap: 2px; padding: 2px; box-sizing: border-box;
    background: var(--sg-row-hover-bg, #f1f5f9); border-radius: calc(var(--sg-radius, 8px) + 2px);
    border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-seg.is-block { display: flex; width: 100%; }
  .sv-seg.is-disabled { opacity: 0.6; }
  .sv-seg__opt {
    flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 0 12px; border: 0; border-radius: var(--sg-radius, 8px); background: none; cursor: pointer;
    font: inherit; font-weight: 550; color: var(--sg-muted, #64748b); white-space: nowrap;
    transition: background 0.14s, color 0.14s, box-shadow 0.14s;
  }
  .sv-seg--sm .sv-seg__opt { height: 26px; font-size: 12px; }
  .sv-seg--md .sv-seg__opt { height: 32px; font-size: 13px; }
  .sv-seg--lg .sv-seg__opt { height: 38px; font-size: 14.5px; }
  .sv-seg__opt:hover:not(.is-selected):not([disabled]) { color: var(--sg-fg, #0f172a); }
  .sv-seg__opt.is-selected {
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  }
  .sv-seg__opt[disabled] { opacity: 0.5; cursor: default; }
  .sv-seg__opt:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px; }
  .sv-seg.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-seg__icon { display: inline-flex; }
  @media (prefers-reduced-motion: reduce) { .sv-seg__opt { transition: none; } }
</style>
