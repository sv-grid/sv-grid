<script lang="ts">
  /**
   * SvTextInput - the base single-line text editor on the shared editor contract
   * (label / hint / error / RTL / a11y via SvField). Handles `text`, `email`,
   * `url`, `tel` and `search`. As a grid cell editor it honours the interaction
   * contract: Enter commits, Escape cancels. Parity: Smart `smart-input`.
   *
   * The control box, size, invalid state, clear button and leading/trailing
   * adornments are all owned by SvField's `frame` mode, so they behave identically
   * across the text-input family.
   */
  import type { Snippet } from 'svelte'
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type EditorAction, type SvEditorProps } from './editor-contract'

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
    /** Select the whole value whenever the field is focused. */
    selectOnFocus?: boolean
    /** Leading adornment (icon/button) inside the field. */
    leading?: Snippet
    /** Trailing adornment (icon/button) inside the field. */
    trailing?: Snippet
    /** Plain-text affix at the start (e.g. a `$` or protocol). */
    prefix?: string
    /** Plain-text affix at the end (e.g. a unit). */
    suffix?: string
    /** `floating` animates the label up on focus/value. Default `static`. */
    labelMode?: 'static' | 'floating'
    /** Compact in-field action buttons (lookup/generate/copy...). */
    actions?: EditorAction[]
    /** Stretch to the container width. */
    block?: boolean
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
    loading = false,
    autocomplete,
    autofocus = false,
    selectOnFocus = false,
    leading,
    trailing,
    prefix,
    suffix,
    labelMode = 'static',
    actions,
    block = false,
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
  function onFocus(e: FocusEvent) {
    if (selectOnFocus) (e.currentTarget as HTMLInputElement).select()
  }
</script>

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
  {leading}
  {trailing}
  {prefix}
  {suffix}
  {labelMode}
  filled={!!value}
  {actions}
  clearable={clearable}
  showClear={!!value}
  onclear={() => set('')}
>
  <input
    use:mountFocus
    class="sv-text__input"
    {type}
    {value}
    placeholder={labelMode === 'floating' ? undefined : placeholder}
    {disabled}
    {readonly}
    {maxlength}
    {autocomplete}
    oninput={onInput}
    onkeydown={onKeydown}
    onfocus={onFocus}
    {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
  />
  {#if name}<input type="hidden" {name} value={value} />{/if}
</SvField>
