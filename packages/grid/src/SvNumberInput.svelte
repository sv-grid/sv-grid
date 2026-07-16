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
  import { editorErrorId, type SvEditorProps } from './editor-contract'
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
  }

  let {
    value = null,
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
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    id,
  }: Props = $props()

  const num = createNumberInput({
    value: () => value,
    onChange: (v) => onChange?.(v),
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
    id: () => id,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    ariaLabel: () => ariaLabel,
  })
</script>

<div class="sv-field">
  <div class="sv-num sv-num--{size}" class:is-disabled={disabled} class:is-invalid={invalid}>
    <input class="sv-num__input" {...num.inputProps()} />
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
  {#if error}<span class="sv-field__error" id={editorErrorId(id)} role="alert">{error}</span>{/if}
</div>

<style>
  /* Shared field wrapper: stacks the control box above an optional error line. */
  .sv-field { display: inline-flex; flex-direction: column; gap: 3px; }
  .sv-field__error { font-size: 11.5px; font-weight: 500; color: var(--sg-danger, #dc2626); line-height: 1.35; }
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
    text-align: right; padding: 0 8px;
  }
  .sv-num--sm { height: 28px; font-size: 12px; }
  .sv-num--md { height: 34px; font-size: 13px; }
  .sv-num--lg { height: 40px; font-size: 15px; }
  .sv-num__spin { display: flex; flex-direction: column; border-left: 1px solid var(--sg-border, #e2e8f0); }
  .sv-num__spin :global(.sv-repeat) { flex: 1; padding: 0 6px; border-radius: 0; }
</style>
