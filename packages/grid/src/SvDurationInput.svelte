<script lang="ts">
  /**
   * SvDurationInput - a duration editor whose value is a number of MINUTES but
   * which accepts the human forms people type ("1h 30m", "1:30", "90"). It shows
   * a formatted value when unfocused and re-parses on blur / Enter. As a grid
   * cell editor: Enter commits, Escape cancels.
   */
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
    autofocus = false,
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

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-dur sv-dur--{size}" class:is-disabled={disabled}>
    <div class="sv-dur__field" class:is-invalid={invalid}>
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
    </div>
    {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  </div>
</SvField>

<style>
  .sv-dur { --_accent: var(--sg-accent, #2563eb); display: inline-flex; flex-direction: column; width: 160px; }
  .sv-dur.is-disabled { opacity: 0.6; }
  .sv-dur__field {
    display: flex; align-items: center;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-dur__field:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-dur__field.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-dur__input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding: 0 10px; }
  .sv-dur--sm .sv-dur__field { height: 28px; font-size: 12px; }
  .sv-dur--md .sv-dur__field { height: 34px; font-size: 13px; }
  .sv-dur--lg .sv-dur__field { height: 40px; font-size: 15px; }
</style>
