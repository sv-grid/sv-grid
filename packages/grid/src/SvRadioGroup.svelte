<script lang="ts" module>
  export type { RadioOption } from './createRadioGroup.svelte'
</script>

<script lang="ts">
  /**
   * SvRadioGroup - an accessible radio group (WAI-ARIA radiogroup pattern) with
   * roving tabindex + arrow-key navigation. Parity: Smart `smart-radio-button`
   * (as a managed group). Controlled via `value` + `onChange`.
   */
  import { createRadioGroup, type RadioOption } from './createRadioGroup.svelte'

  type Props = {
    options: ReadonlyArray<RadioOption>
    value?: string | number | null
    onChange?: (value: string | number) => void
    name?: string
    disabled?: boolean
    orientation?: 'vertical' | 'horizontal'
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
  }

  let {
    options,
    value = null,
    onChange,
    name,
    disabled = false,
    orientation = 'vertical',
    size = 'md',
    ariaLabel,
  }: Props = $props()

  // The styled radio group is just a renderer over the headless core.
  const rg = createRadioGroup({
    options: () => options,
    value: () => value,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
  })
</script>

<div
  class="sv-radiogroup sv-radiogroup--{orientation} sv-radiogroup--{size}"
  {...rg.groupProps()}
>
  {#each options as opt (opt.value)}
    <button
      class="sv-radio"
      class:is-checked={opt.value === value}
      {...rg.radioProps(opt)}
    >
      <span class="sv-radio__dot"></span>
      <span class="sv-radio__label">{opt.label}</span>
    </button>
  {/each}
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
</div>

<style>
  .sv-radiogroup { --_accent: var(--sg-accent, #2563eb); display: flex; gap: 10px; }
  .sv-radiogroup--vertical { flex-direction: column; }
  .sv-radiogroup--horizontal { flex-direction: row; flex-wrap: wrap; }
  .sv-radio {
    display: inline-flex; align-items: center; gap: 8px; background: none; border: 0; padding: 2px;
    font: inherit; color: var(--sg-fg, #0f172a); cursor: pointer; user-select: none;
  }
  .sv-radiogroup--sm .sv-radio { font-size: 12px; }
  .sv-radiogroup--md .sv-radio { font-size: 13px; }
  .sv-radiogroup--lg .sv-radio { font-size: 15px; }
  .sv-radio[disabled] { opacity: 0.5; cursor: not-allowed; }
  .sv-radio__dot {
    width: 17px; height: 17px; flex: none; border-radius: 50%;
    border: 1.5px solid var(--sg-border, #cbd5e1); background: var(--sg-input-bg, #fff);
    display: grid; place-items: center; transition: border-color 0.12s;
  }
  .sv-radio.is-checked .sv-radio__dot { border-color: var(--_accent); }
  .sv-radio.is-checked .sv-radio__dot::after {
    content: ''; width: 9px; height: 9px; border-radius: 50%; background: var(--_accent);
  }
  .sv-radio:focus-visible { outline: none; }
  .sv-radio:focus-visible .sv-radio__dot { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
