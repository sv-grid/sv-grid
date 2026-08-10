<script lang="ts">
  /**
   * SvDurationInput - a duration editor whose value is a number of MINUTES but
   * which accepts the human forms people type ("1h 30m", "1:30", "90"). It shows
   * a formatted value when unfocused and re-parses on blur / Enter. As a grid
   * cell editor: Enter commits, Escape cancels. The box, size and invalid state
   * are owned by SvField's `frame` chrome.
   */
  import type { Snippet } from 'svelte'
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'
  import { parseDuration, formatDuration } from './duration'

  type Props = SvEditorProps & {
    /** Value in minutes (or null when empty). */
    value?: number | null
    onChange?: (minutes: number | null) => void
    onCommit?: (minutes: number | null) => void
    onCancel?: () => void
    /** Display style when unfocused: `1:30` (colon) or `1h 30m` (units). */
    style?: 'colon' | 'units'
    placeholder?: string
    autofocus?: boolean
    /** Show a clear (x) button when there is a value. */
    clearable?: boolean
    /** Leading adornment (icon) inside the field. */
    leading?: Snippet
    /** Trailing adornment (icon) inside the field. */
    trailing?: Snippet
    /** Stretch to the container width. */
    block?: boolean
    /** Control width in px (ignored when `block`). Default 160. */
    width?: number
  }

  let {
    value = $bindable<number | null>(null),
    onChange,
    onCommit,
    onCancel,
    style = 'colon',
    placeholder = 'e.g. 1h 30m',
    disabled = false,
    readonly = false,
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
    autofocus = false,
    clearable = false,
    leading,
    trailing,
    block = false,
    width = 160,
  }: Props = $props()

  const autoId = nextEditorId('sv-dur')
  const uid = $derived(id ?? autoId)

  let text = $state('')
  let focused = $state(false)
  // Reflect the external value into the field whenever the user isn't typing.
  $effect(() => {
    if (!focused) text = value == null ? '' : formatDuration(value, style)
  })

  function commit(): number | null {
    const mins = parseDuration(text)
    value = mins // enables bind:value
    onChange?.(mins)
    if (mins != null) text = formatDuration(mins, style)
    return mins
  }
  function mountFocus(node: HTMLInputElement) {
    if (autofocus) { node.focus(); node.select() }
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
  {width}
  {leading}
  {trailing}
  clearable={clearable}
  showClear={value != null}
  onclear={() => { value = null; text = ''; onChange?.(null) }}
>
  <input
    use:mountFocus
    class="sv-dur__input"
    type="text"
    inputmode="numeric"
    value={text}
    {placeholder}
    {disabled}
    {readonly}
    oninput={(e) => (text = e.currentTarget.value)}
    onfocus={() => (focused = true)}
    onblur={() => { focused = false; commit() }}
    onkeydown={(e) => {
      if (e.key === 'Enter') { onCommit?.(commit()) }
      else if (e.key === 'Escape') onCancel?.()
    }}
    {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
  />
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
</SvField>
