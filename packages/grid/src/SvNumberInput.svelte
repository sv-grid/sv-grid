<script lang="ts">
  /**
   * SvNumberInput - a numeric input with min/max/step, spinner buttons, optional
   * thousands grouping + precision, prefix/suffix. Parity: Smart `smart-number-input`.
   * Emits number | null. The SvGrid number cell editor, standalone too.
   *
   * This is the styled renderer over the headless `createNumberInput` core - the
   * same split as the grid (`createSvGrid` / `<SvGrid>`): parse/format/clamp,
   * spinner + keyboard and ARIA all come from the core via prop-getters. The box,
   * size, invalid state and focus ring are owned by SvField's `frame` chrome; the
   * `prefix`/`suffix` are formatted INTO the value (they travel with the
   * right-aligned number), and the spinner + clear live in the trailing slot.
   */
  import type { Snippet } from 'svelte'
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
    /** Text formatted before the number (e.g. `$`); travels with the value. */
    prefix?: string
    /** Text formatted after the number (e.g. `%`); travels with the value. */
    suffix?: string
    placeholder?: string
    spinButtons?: boolean
    /** Show a clear (x) button when there is a value. */
    clearable?: boolean
    /** Select the whole value when the field is focused. */
    selectOnFocus?: boolean
    /** Step the value with the mouse wheel while the field is focused. */
    wheelStep?: boolean
    /** Leading adornment (icon) inside the field. */
    leading?: Snippet
    /** Stretch to the container width. */
    block?: boolean
    /** Control width in px (ignored when `block`). Default 150. */
    width?: number
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
    selectOnFocus = false,
    wheelStep = false,
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
    loading = false,
    leading,
    block = false,
    width = 150,
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

  // DOM-bound ergonomics the headless core stays out of: select-all on focus and
  // wheel-to-step (only while focused, so scrolling the page never changes it).
  function numExtras(node: HTMLInputElement) {
    const onFocus = () => { if (selectOnFocus) requestAnimationFrame(() => node.select()) }
    const onWheel = (e: WheelEvent) => {
      if (!wheelStep || document.activeElement !== node || !num.isInteractive) return
      e.preventDefault()
      num.bump(e.deltaY < 0 ? 1 : -1)
    }
    node.addEventListener('focus', onFocus)
    node.addEventListener('wheel', onWheel, { passive: false })
    return { destroy() { node.removeEventListener('focus', onFocus); node.removeEventListener('wheel', onWheel) } }
  }
</script>

{#snippet trailing()}
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
{/snippet}

<SvField
  frame
  id={uid}
  {label}
  {hint}
  {error}
  {required}
  {dir}
  {size}
  {invalid}
  {disabled}
  {readonly}
  {loading}
  {block}
  {width}
  {leading}
  {trailing}
>
  <input class="sv-num__input" use:numExtras {...num.inputProps()} />
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
</SvField>

<style>
  .sv-num__input { text-align: end; }
  .sv-num__clear { display: grid; place-items: center; width: 20px; align-self: center; flex: none; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 4px; }
  .sv-num__clear:hover { color: var(--sg-danger, #dc2626); }
  .sv-num__spin { display: flex; flex-direction: column; margin-inline-start: 2px; }
  .sv-num__spin :global(.sv-repeat) { flex: 1; min-height: 0; padding: 0 5px; border-radius: 4px; line-height: 1; }
</style>
