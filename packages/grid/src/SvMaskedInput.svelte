<script lang="ts">
  /**
   * SvMaskedInput - a pattern-masked text input (#=digit, A=letter, *=alnum;
   * other chars are literals). Parity: Smart `smart-masked-text-box`. Emits both
   * the masked display value and the raw (unmasked) value.
   *
   * The styled renderer over the headless `createMaskedInput` core; the mask
   * formatting + state live in the core, spread here via prop-getters.
   */
  import { unmask } from './datetime/mask'
  import { createMaskedInput } from './createMaskedInput.svelte'

  type Props = {
    value?: string
    /** Called with (masked, raw, complete). */
    onChange?: (masked: string, raw: string, complete: boolean) => void
    mask?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    name?: string
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
  }

  let {
    value = '',
    onChange,
    mask = '',
    placeholder,
    disabled = false,
    readonly = false,
    name,
    size = 'md',
    ariaLabel,
  }: Props = $props()

  const mi = createMaskedInput({
    value: () => value,
    onChange: (m, r, c) => onChange?.(m, r, c),
    mask: () => mask,
    placeholder: () => placeholder,
    disabled: () => disabled,
    readonly: () => readonly,
    ariaLabel: () => ariaLabel,
  })
</script>

<input class="sv-masked sv-masked--{size}" {...mi.inputProps()} />
{#if name}<input type="hidden" {name} value={mask ? unmask(mi.masked, mask) : mi.masked} />{/if}

<style>
  .sv-masked {
    --_accent: var(--sg-accent, #2563eb);
    box-sizing: border-box; width: 200px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; padding: 0 10px; outline: none;
    font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
  }
  .sv-masked--sm { height: 28px; font-size: 12px; }
  .sv-masked--md { height: 34px; font-size: 13px; }
  .sv-masked--lg { height: 40px; font-size: 15px; }
  .sv-masked:focus { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-masked:disabled { opacity: 0.6; }
</style>
