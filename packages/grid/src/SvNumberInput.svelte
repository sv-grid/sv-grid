<script lang="ts">
  /**
   * SvNumberInput - a numeric input with min/max/step, spinner buttons, optional
   * thousands grouping + precision, prefix/suffix. Parity: Smart `smart-number-input`.
   * Emits number | null. The SvGrid number cell editor, standalone too.
   *
   * This is the styled renderer over the headless `createNumberInput` core - the
   * same split as the grid (`createSvGrid` / `<SvGrid>`): parse/format/clamp,
   * spinner + keyboard and ARIA all come from the core via prop-getters.
   */
  import SvRepeatButton from './SvRepeatButton.svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createNumberInput } from './createNumberInput.svelte'

  type Props = SvEditorProps & {
    value?: number | null
    onChange?: (value: number | null) => void
    min?: number
    max?: number
    step?: number
    precision?: number
    /** Group thousands (1,234) on display. */
    grouping?: boolean
    prefix?: string
    suffix?: string
    placeholder?: string
    spinButtons?: boolean
    /** Show a clear (x) button when there is a value. */
    clearable?: boolean
  }

  let {
    value = $bindable<number | null>(null),
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
    precision,
    grouping = false,
    prefix = '',
    suffix = '',
    placeholder,
    disabled = false,
    readonly = false,
    spinButtons = true,
    clearable = false,
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
  }: Props = $props()

  const autoId = nextEditorId('sv-num')
  const uid = $derived(id ?? autoId)

  const num = createNumberInput({
    value: () => value,
    // Write `value` (so `bind:value` works) AND fire `onChange` (callback users).
    onChange: (v) => { value = v; onChange?.(v) },
    min: () => min,
    max: () => max,
    step: () => step,
    precision: () => precision,
    grouping: () => grouping,
    prefix: () => prefix,
    suffix: () => suffix,
    placeholder: () => placeholder,
    disabled: () => disabled,
    readonly: () => readonly,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-num sv-num--{size}" class:is-disabled={disabled} class:is-invalid={invalid}>
    <input class="sv-num__input" {...num.inputProps()} />
    {#if clearable && value != null && !disabled && !readonly}
      <button type="button" class="sv-num__clear" aria-label="Clear" tabindex="-1" onclick={() => { value = null; onChange?.(null) }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    {/if}
    {#if spinButtons}
      <div class="sv-num__spin">
        <SvRepeatButton size="sm" variant="ghost" ariaLabel="Increment" onclick={num.increment}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6" /></svg>
        </SvRepeatButton>
        <SvRepeatButton size="sm" variant="ghost" ariaLabel="Decrement" onclick={num.decrement}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </SvRepeatButton>
      </div>
    {/if}
    {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  </div>
</SvField>

<style>
  .sv-num {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: stretch; width: 150px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    overflow: hidden;
  }
  .sv-num:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-num.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-num.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-num.is-disabled { opacity: 0.6; }
  .sv-num__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit;
    text-align: end; padding: 0 8px;
  }
  .sv-num--sm { height: 28px; font-size: 12px; }
  .sv-num--md { height: 34px; font-size: 13px; }
  .sv-num--lg { height: 40px; font-size: 15px; }
  .sv-num__clear { display: grid; place-items: center; width: 22px; align-self: center; flex: none; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 4px; }
  .sv-num__clear:hover { color: var(--sg-danger, #dc2626); }
  .sv-num__spin { display: flex; flex-direction: column; border-inline-start: 1px solid var(--sg-border, #e2e8f0); }
  .sv-num__spin :global(.sv-repeat) { flex: 1; padding: 0 6px; border-radius: 0; }
</style>
