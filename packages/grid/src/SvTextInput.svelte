<script lang="ts">
  /**
   * SvTextInput - the base single-line text editor on the shared editor contract
   * (label / hint / error / RTL / a11y via SvField). Handles `text`, `email`,
   * `url`, `tel` and `search`. As a grid cell editor it honours the interaction
   * contract: Enter commits, Escape cancels. Parity: Smart `smart-input`.
   */
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'

  type Props = SvEditorProps & {
    value?: string
    onChange?: (value: string) => void
    /** Commit + stop editing (Enter, or supplied by the grid in a cell). */
    onCommit?: (value: string) => void
    /** Cancel editing (Escape). */
    onCancel?: () => void
    placeholder?: string
    type?: 'text' | 'email' | 'url' | 'tel' | 'search'
    maxlength?: number
    /** Show an inline clear (x) button when non-empty. */
    clearable?: boolean
    autocomplete?: AutoFill
    /** Autofocus + select on mount (used when mounted as a cell editor). */
    autofocus?: boolean
  }

  let {
    value = $bindable(''),
    onChange,
    onCommit,
    onCancel,
    placeholder,
    disabled = false,
    readonly = false,
    type = 'text',
    maxlength,
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
    autocomplete,
    autofocus = false,
  }: Props = $props()

  const autoId = nextEditorId('sv-text')
  const uid = $derived(id ?? autoId)

  // Write `value` (so `bind:value` works) AND fire `onChange` (callback users).
  function set(v: string) {
    value = v
    onChange?.(v)
  }
  function onInput(e: Event) {
    set((e.currentTarget as HTMLInputElement).value)
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') onCommit?.(value)
    else if (e.key === 'Escape') onCancel?.()
  }
  function mountFocus(node: HTMLInputElement) {
    if (autofocus) { node.focus(); node.select() }
  }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-text sv-text--{size}" class:is-disabled={disabled}>
    <div class="sv-text__field" class:is-invalid={invalid}>
      <input
        use:mountFocus
        class="sv-text__input"
        {type}
        {value}
        {placeholder}
        {disabled}
        {readonly}
        {maxlength}
        {autocomplete}
        oninput={onInput}
        onkeydown={onKeydown}
        {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
      />
      {#if clearable && value && !disabled && !readonly}
        <button class="sv-text__clear" type="button" tabindex="-1" aria-label="Clear" onclick={() => set('')}>&times;</button>
      {/if}
    </div>
    {#if name}<input type="hidden" {name} value={value} />{/if}
  </div>
</SvField>

<style>
  .sv-text { --_accent: var(--sg-accent, #2563eb); display: inline-flex; flex-direction: column; width: 220px; }
  .sv-text.is-disabled { opacity: 0.6; }
  .sv-text__field {
    display: flex; align-items: center;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-text__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-text__field.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-text__field.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-text__input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding: 0 10px; }
  .sv-text--sm .sv-text__field { height: 28px; font-size: 12px; }
  .sv-text--md .sv-text__field { height: 34px; font-size: 13px; }
  .sv-text--lg .sv-text__field { height: 40px; font-size: 15px; }
  .sv-text__clear { display: grid; place-items: center; width: 28px; align-self: stretch; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 17px; line-height: 1; }
  .sv-text__clear:hover { color: var(--sg-fg, #0f172a); }
</style>
