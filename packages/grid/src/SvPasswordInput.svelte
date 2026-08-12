<script lang="ts">
  /**
   * SvPasswordInput - a password field with a reveal toggle and an optional
   * strength meter. Parity: Smart `smart-password-input`. Emits the string value.
   *
   * The styled renderer over the headless `createPasswordInput` core: the reveal
   * toggle + strength heuristic come from the core, spread here via prop-getters.
   * The box, size, invalid state and focus ring are owned by SvField's `frame`
   * chrome; the reveal eye lives in the trailing slot and the strength meter sits
   * below the field.
   */
  import type { Snippet } from 'svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createPasswordInput } from './createPasswordInput.svelte'

  /** User-facing strings for the password input (localizable via `messages`). */
  type PasswordMessages = { show: string; hide: string; weak: string; fair: string; good: string; strong: string }
  const DEFAULT_MESSAGES: PasswordMessages = {
    show: 'Show password', hide: 'Hide password',
    weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong',
  }

  type Props = SvEditorProps & {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
    /** Show the show/hide eye toggle. */
    revealable?: boolean
    /** Show a 4-level strength meter. */
    showStrength?: boolean
    autocomplete?: string
    /** Override the built-in strings (reveal toggle + strength labels). */
    messages?: Partial<PasswordMessages>
    /** Leading adornment (icon) inside the field. */
    leading?: Snippet
    /** Stretch to the container width. */
    block?: boolean
    /** Control width in px (ignored when `block`). Default 220. */
    width?: number
  }

  let {
    value = $bindable(''),
    onChange,
    placeholder,
    disabled = false,
    readonly = false,
    revealable = true,
    showStrength = false,
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
    autocomplete = 'current-password',
    messages,
    leading,
    block = false,
    width = 220,
  }: Props = $props()

  const autoId = nextEditorId('sv-pass')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const pw = createPasswordInput({
    value: () => value,
    // Write `value` (so `bind:value` works) AND fire `onChange` (callback users).
    onChange: (v) => { value = v; onChange?.(v) },
    placeholder: () => placeholder,
    disabled: () => disabled,
    readonly: () => readonly,
    ariaLabel: () => ariaLabel,
    autocomplete: () => autocomplete,
    showLabel: () => M.show,
    hideLabel: () => M.hide,
    strengthLabels: () => ['', M.weak, M.fair, M.good, M.strong],
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
</script>

{#snippet eye()}
  {#if revealable}
    <button class="sv-pw__eye" {...pw.toggleProps()}>
      {#if pw.revealed}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      {/if}
    </button>
  {/if}
{/snippet}

<div class="sv-pw" class:sv-pw--block={block}>
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
    trailing={revealable ? eye : undefined}
  >
    <input class="sv-pw__input" {...pw.inputProps()} />
    {#if name}<input type="hidden" {name} value={value} />{/if}
  </SvField>
  {#if showStrength}
    <div class="sv-pw__meter" aria-hidden="true">
      {#each Array(4) as _, i (i)}
        <span class="sv-pw__bar is-lvl{pw.strength}" class:on={i < pw.strength}></span>
      {/each}
    </div>
    <span class="sv-pw__strength is-lvl{pw.strength}">{pw.strengthLabel}</span>
  {/if}
</div>

<style>
  .sv-pw { display: inline-flex; flex-direction: column; gap: 5px; }
  .sv-pw--block { display: flex; width: 100%; }
  .sv-pw__eye { display: grid; place-items: center; width: 26px; align-self: center; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; padding: 0; }
  .sv-pw__eye:hover { color: var(--sg-accent, #2563eb); }
  .sv-pw__meter { display: flex; gap: 4px; }
  .sv-pw__bar { flex: 1; height: 4px; border-radius: 2px; background: var(--sg-border, #e2e8f0); transition: background 0.15s; }
  .sv-pw__bar.on.is-lvl1 { background: var(--sg-danger, #dc2626); }
  .sv-pw__bar.on.is-lvl2 { background: var(--sg-warning, #f59e0b); }
  .sv-pw__bar.on.is-lvl3 { background: #eab308; }
  .sv-pw__bar.on.is-lvl4 { background: var(--sg-success, #16a34a); }
  .sv-pw__strength { font-size: 11px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-pw__strength.is-lvl1 { color: var(--sg-danger, #dc2626); }
  .sv-pw__strength.is-lvl4 { color: var(--sg-success, #16a34a); }
</style>
