<script lang="ts">
  /**
   * SvTextArea - a multi-line text editor on the shared editor contract, with an
   * optional auto-grow (the box height follows the content) and a character
   * counter. Parity: Smart multiline input. As a grid cell editor: Escape
   * cancels; Ctrl/Cmd+Enter commits (a bare Enter inserts a newline).
   */
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'

  type Props = SvEditorProps & {
    value?: string
    onChange?: (value: string) => void
    onCommit?: (value: string) => void
    onCancel?: () => void
    placeholder?: string
    rows?: number
    maxlength?: number
    /** Grow the box to fit content instead of scrolling. */
    autoGrow?: boolean
    /** Show a "n / max" character counter (needs `maxlength`). */
    showCount?: boolean
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
    rows = 3,
    maxlength,
    autoGrow = false,
    showCount = false,
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

  const autoId = nextEditorId('sv-textarea')
  const uid = $derived(id ?? autoId)

  function grow(node: HTMLTextAreaElement) {
    if (!autoGrow) return
    const resize = () => { node.style.height = 'auto'; node.style.height = `${node.scrollHeight}px` }
    resize()
    node.addEventListener('input', resize)
    return { destroy: () => node.removeEventListener('input', resize) }
  }
  function mountFocus(node: HTMLTextAreaElement) {
    if (autofocus) { node.focus(); node.select() }
  }
  function onInput(e: Event) {
    const v = (e.currentTarget as HTMLTextAreaElement).value
    value = v // enables bind:value
    onChange?.(v)
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel?.()
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCommit?.(value) }
  }
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-ta sv-ta--{size}" class:is-disabled={disabled}>
    <textarea
      use:grow
      use:mountFocus
      class="sv-ta__input"
      class:is-invalid={invalid}
      {value}
      {placeholder}
      {disabled}
      {readonly}
      {rows}
      {maxlength}
      oninput={onInput}
      onkeydown={onKeydown}
      {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
    ></textarea>
    {#if showCount && maxlength}
      <span class="sv-ta__count" aria-hidden="true">{value.length} / {maxlength}</span>
    {/if}
    {#if name}<input type="hidden" {name} value={value} />{/if}
  </div>
</SvField>

<style>
  .sv-ta { --_accent: var(--sg-accent, #2563eb); display: inline-flex; flex-direction: column; gap: 3px; width: 260px; }
  .sv-ta.is-disabled { opacity: 0.6; }
  .sv-ta__input {
    width: 100%; box-sizing: border-box; resize: vertical; font: inherit; padding: 8px 10px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px); outline: none;
  }
  .sv-ta--sm .sv-ta__input { font-size: 12px; }
  .sv-ta--md .sv-ta__input { font-size: 13px; }
  .sv-ta--lg .sv-ta__input { font-size: 15px; }
  .sv-ta__input:focus { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-ta__input.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-ta__count { align-self: flex-end; font-size: 11px; color: var(--sg-muted, #64748b); }
</style>
