<script lang="ts">
  /**
   * SvPasswordInput - a password field with a reveal toggle and an optional
   * strength meter. Parity: Smart `smart-password-input`. Emits the string value.
   *
   * The styled renderer over the headless `createPasswordInput` core: the reveal
   * toggle + strength heuristic come from the core, spread here via prop-getters.
   */
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
  }

  let {
    value = '',
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
    autocomplete = 'current-password',
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-pass')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const pw = createPasswordInput({
    value: () => value,
    onChange: (v) => onChange?.(v),
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

<SvField id={uid} {label} {hint} {error} {required} {dir}>
<div class="sv-pw sv-pw--{size}" class:is-disabled={disabled}>
  <div class="sv-pw__field" class:is-invalid={invalid}>
    <input class="sv-pw__input" {...pw.inputProps()} />
    {#if revealable}
      <button class="sv-pw__eye" {...pw.toggleProps()}>
        {#if pw.revealed}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        {/if}
      </button>
    {/if}
  </div>
  {#if showStrength}
    <div class="sv-pw__meter" aria-hidden="true">
      {#each Array(4) as _, i (i)}
        <span class="sv-pw__bar is-lvl{pw.strength}" class:on={i < pw.strength}></span>
      {/each}
    </div>
    <span class="sv-pw__strength is-lvl{pw.strength}">{pw.strengthLabel}</span>
  {/if}
  {#if name}<input type="hidden" {name} value={value} />{/if}
</div>
</SvField>

<style>
  .sv-pw { --_accent: var(--sg-accent, #2563eb); display: inline-flex; flex-direction: column; gap: 5px; width: 220px; }
  .sv-pw.is-disabled { opacity: 0.6; }
  .sv-pw__field {
    display: flex; align-items: center;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-pw__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-pw__field.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-pw__field.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-pw__input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding: 0 10px; }
  .sv-pw--sm .sv-pw__field { height: 28px; font-size: 12px; }
  .sv-pw--md .sv-pw__field { height: 34px; font-size: 13px; }
  .sv-pw--lg .sv-pw__field { height: 40px; font-size: 15px; }
  .sv-pw__eye { display: grid; place-items: center; width: 32px; align-self: stretch; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; }
  .sv-pw__eye:hover { color: var(--_accent); }
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
