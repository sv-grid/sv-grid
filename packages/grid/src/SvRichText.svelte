<script lang="ts" module>
  export type RichTextTool =
    | 'bold' | 'italic' | 'underline' | 'strike'
    | 'h1' | 'h2' | 'h3' | 'p'
    | 'ul' | 'ol' | 'quote' | 'code'
    | 'alignLeft' | 'alignCenter' | 'alignRight'
    | 'link' | 'clear' | 'undo' | 'redo'
    | '|'
</script>

<script lang="ts">
  /**
   * SvRichText - a lightweight WYSIWYG editor: a formatting toolbar over a
   * `contentEditable` region, emitting HTML. Parity: Smart `smart-editor` (the
   * common commands). Uses `document.execCommand` - the pragmatic, widely-working
   * approach for a component-kit editor. Bindable `value` (HTML string).
   *
   * ```svelte
   * <SvRichText bind:value={html} placeholder="Write something…" />
   * ```
   */
  import { nextEditorId, resolveMessages } from './editor-contract'

  const DEFAULT_TOOLS: RichTextTool[] = [
    'bold', 'italic', 'underline', 'strike', '|',
    'h1', 'h2', 'h3', 'p', '|',
    'ul', 'ol', 'quote', 'code', '|',
    'alignLeft', 'alignCenter', 'alignRight', '|',
    'link', 'clear', '|', 'undo', 'redo',
  ]

  /** Toolbar glyphs. Mode-independent and not language-dependent, so they stay
   *  fixed; the LABELS beside them are localizable via `messages`. */
  const GLYPH: Record<Exclude<RichTextTool, '|'>, string> = {
    bold: 'B', italic: 'I', underline: 'U', strike: 'S',
    h1: 'H1', h2: 'H2', h3: 'H3', p: '¶',
    ul: '•', ol: '1.', quote: '❝', code: '</>',
    alignLeft: '≡', alignCenter: '≣', alignRight: '≡', link: '🔗',
    clear: '⌫', undo: '↶', redo: '↷',
  }

  /** User-facing strings (localizable via `messages`). Every one is a tooltip +
   *  accessible name on a toolbar button, so leaving them hard-coded made the
   *  whole toolbar English-only for screen-reader users. */
  type RichTextMessages = Record<Exclude<RichTextTool, '|'>, string> & { linkPrompt: string; toolbar: string }
  const DEFAULT_MESSAGES: RichTextMessages = {
    bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough',
    h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', p: 'Paragraph',
    ul: 'Bullet list', ol: 'Numbered list', quote: 'Quote', code: 'Code block',
    alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
    link: 'Link', clear: 'Clear formatting', undo: 'Undo', redo: 'Redo',
    linkPrompt: 'Link URL', toolbar: 'Formatting',
  }

  type Props = {
    /** HTML string (bindable). */
    value?: string
    onChange?: (html: string) => void
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    minHeight?: string
    /** Toolbar tools + order; use '|' for a separator. */
    tools?: RichTextTool[]
    ariaLabel?: string
    /** Override any toolbar label / prompt (localization). */
    messages?: Partial<RichTextMessages>
  }

  let {
    value = $bindable(''),
    onChange,
    placeholder = '',
    disabled = false,
    readonly = false,
    minHeight = '160px',
    tools = DEFAULT_TOOLS,
    ariaLabel = 'Rich text editor',
    messages,
  }: Props = $props()

  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))
  const uid = nextEditorId('sv-rt')
  let editorEl = $state<HTMLDivElement | null>(null)
  let focused = $state(false)
  let empty = $state(true)
  let activeState = $state<Record<string, boolean>>({})

  // Push external value into the DOM only when it differs and we're not typing
  // (writing innerHTML while focused would collapse the caret).
  $effect(() => {
    const v = value ?? ''
    if (editorEl && !focused && editorEl.innerHTML !== v) editorEl.innerHTML = v
    if (editorEl) empty = editorEl.textContent!.trim().length === 0
  })

  function sync() {
    if (!editorEl) return
    const html = editorEl.innerHTML
    empty = editorEl.textContent!.trim().length === 0
    value = html
    onChange?.(html)
  }
  function q(cmd: string): boolean {
    try { return document.queryCommandState(cmd) } catch { return false }
  }
  function refreshState() {
    activeState = {
      bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
      ul: q('insertUnorderedList'), ol: q('insertOrderedList'),
    }
  }
  function exec(cmd: string, arg?: string) {
    if (disabled || readonly) return
    editorEl?.focus()
    try { document.execCommand(cmd, false, arg) } catch { /* jsdom / unsupported */ }
    sync()
    refreshState()
  }

  const run: Record<Exclude<RichTextTool, '|'>, () => void> = {
    bold: () => exec('bold'), italic: () => exec('italic'), underline: () => exec('underline'), strike: () => exec('strikeThrough'),
    h1: () => exec('formatBlock', 'H1'), h2: () => exec('formatBlock', 'H2'), h3: () => exec('formatBlock', 'H3'), p: () => exec('formatBlock', 'P'),
    ul: () => exec('insertUnorderedList'), ol: () => exec('insertOrderedList'),
    quote: () => exec('formatBlock', 'BLOCKQUOTE'), code: () => exec('formatBlock', 'PRE'),
    alignLeft: () => exec('justifyLeft'), alignCenter: () => exec('justifyCenter'), alignRight: () => exec('justifyRight'),
    link: () => { const url = typeof prompt === 'function' ? prompt(M.linkPrompt, 'https://') : null; if (url) exec('createLink', url) },
    clear: () => exec('removeFormat'), undo: () => exec('undo'), redo: () => exec('redo'),
  }
</script>

<div class="sv-rt" class:is-disabled={disabled} class:is-readonly={readonly}>
  {#if !readonly}
    <div class="sv-rt__toolbar" role="toolbar" aria-label={M.toolbar} aria-controls={uid}>
      {#each tools as t, i (i)}
        {#if t === '|'}
          <span class="sv-rt__sep" aria-hidden="true"></span>
        {:else}
          <button
            type="button"
            class="sv-rt__btn"
            class:is-on={activeState[t]}
            data-tool={t}
            title={M[t]}
            aria-label={M[t]}
            aria-pressed={activeState[t] ? true : undefined}
            {disabled}
            onmousedown={(e) => e.preventDefault()}
            onclick={run[t]}
          >{GLYPH[t]}</button>
        {/if}
      {/each}
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={editorEl}
    id={uid}
    class="sv-rt__body"
    class:is-empty={empty}
    style:min-height={minHeight}
    contenteditable={!disabled && !readonly}
    role="textbox"
    aria-multiline="true"
    aria-label={ariaLabel}
    data-placeholder={placeholder}
    tabindex={disabled ? -1 : 0}
    oninput={sync}
    onfocus={() => (focused = true)}
    onblur={() => { focused = false; sync() }}
    onkeyup={refreshState}
    onmouseup={refreshState}
  ></div>
</div>

<style>
  .sv-rt {
    --_accent: var(--sg-accent, #2563eb);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); overflow: hidden;
    display: flex; flex-direction: column;
  }
  .sv-rt:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 20%, transparent); }
  .sv-rt.is-disabled { opacity: 0.6; }
  .sv-rt__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 1px; padding: 5px 6px; border-bottom: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-header-bg, #f8fafc); }
  .sv-rt__btn {
    min-width: 28px; height: 28px; padding: 0 6px; display: grid; place-items: center;
    background: none; border: 0; border-radius: 6px; color: var(--sg-fg, #334155); cursor: pointer;
    font-size: 12.5px; font-weight: 600;
  }
  .sv-rt__btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #eef2f7); }
  .sv-rt__btn.is-on { background: color-mix(in srgb, var(--_accent) 16%, transparent); color: var(--_accent); }
  .sv-rt__btn[data-tool='italic'] { font-style: italic; }
  .sv-rt__btn[data-tool='underline'] { text-decoration: underline; }
  .sv-rt__btn[data-tool='strike'] { text-decoration: line-through; }
  .sv-rt__btn[data-tool='alignRight'] { transform: scaleX(-1); }
  .sv-rt__sep { width: 1px; height: 18px; background: var(--sg-border, #e2e8f0); margin: 0 4px; }
  .sv-rt__body { padding: 10px 12px; outline: none; overflow: auto; font-size: 14px; line-height: 1.6; }
  .sv-rt__body.is-empty::before { content: attr(data-placeholder); color: var(--sg-muted, #94a3b8); pointer-events: none; }
  .sv-rt__body :global(h1) { font-size: 1.5em; font-weight: 700; margin: 0.4em 0; }
  .sv-rt__body :global(h2) { font-size: 1.25em; font-weight: 700; margin: 0.4em 0; }
  .sv-rt__body :global(h3) { font-size: 1.1em; font-weight: 650; margin: 0.4em 0; }
  .sv-rt__body :global(blockquote) { margin: 0.4em 0; padding-inline-start: 12px; border-inline-start: 3px solid var(--sg-border, #cbd5e1); color: var(--sg-muted, #64748b); }
  .sv-rt__body :global(pre) { margin: 0.4em 0; padding: 10px 12px; border-radius: 8px; background: var(--sg-row-hover-bg, #f1f5f9); font: 12.5px/1.6 ui-monospace, monospace; overflow-x: auto; }
  .sv-rt__body :global(a) { color: var(--_accent); }
  .sv-rt__body :global(ul), .sv-rt__body :global(ol) { margin: 0.4em 0; padding-inline-start: 24px; }
</style>
