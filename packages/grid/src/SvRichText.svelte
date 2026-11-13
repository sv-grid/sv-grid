<script lang="ts" module>
  export type RichTextTool =
    | 'bold' | 'italic' | 'underline' | 'strike'
    | 'h1' | 'h2' | 'h3' | 'p'
    | 'ul' | 'ol' | 'quote' | 'code'
    | 'alignLeft' | 'alignCenter' | 'alignRight'
    | 'link' | 'clear' | 'undo' | 'redo'
    | 'image' | 'table' | 'hr' | 'source'
    | '|'
</script>

<script lang="ts">
  /**
   * SvRichText - a lightweight WYSIWYG editor: a formatting toolbar over a
   * `contentEditable` region, emitting HTML. Parity: Smart `smart-editor` (the
   * common commands). Uses `document.execCommand` - the pragmatic, widely-working
   * approach for a component-kit editor. Bindable `value` (HTML string).
   *
   * A `value` from outside goes through `sanitizeHtml` before it reaches the DOM,
   * and what the editor hands back goes through it too: a stored string may be
   * someone else's, and `innerHTML` would run what it holds.
   *
   * ```svelte
   * <SvRichText bind:value={html} placeholder="Write something…" />
   * ```
   *
   * Beyond the default toolbar: `image` (uploaded through `onImageUpload`, or by
   * URL without it), `table`, `hr` and `source` (the HTML itself, in a text
   * area) can be listed in `tools`. `name` posts the value with a native form,
   * as a hidden input. `sanitize` replaces the sanitizer for content the app
   * trusts (a CMS page written by its administrators); everywhere else, keep
   * the default.
   */
  import { nextEditorId, resolveMessages } from './editor-contract'
  import { sanitizeHtml, asTrustedHtml } from './sanitize-html'

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
    image: '▣', table: '▦', hr: '―', source: 'HTML',
  }

  /** User-facing strings (localizable via `messages`). Every one is a tooltip +
   *  accessible name on a toolbar button, so leaving them hard-coded made the
   *  whole toolbar English-only for screen-reader users. */
  type RichTextMessages = Record<Exclude<RichTextTool, '|'>, string> & { linkPrompt: string; imagePrompt: string; toolbar: string }
  const DEFAULT_MESSAGES: RichTextMessages = {
    bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough',
    h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', p: 'Paragraph',
    ul: 'Bullet list', ol: 'Numbered list', quote: 'Quote', code: 'Code block',
    alignLeft: 'Align left', alignCenter: 'Align center', alignRight: 'Align right',
    link: 'Link', clear: 'Clear formatting', undo: 'Undo', redo: 'Redo',
    image: 'Image', table: 'Table', hr: 'Horizontal line', source: 'HTML source',
    linkPrompt: 'Link URL', imagePrompt: 'Image URL', toolbar: 'Formatting',
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
    /** The `image` tool's upload: given the picked file, resolve to the URL to
     *  insert (or null to insert nothing). Without it, the tool asks for a URL. */
    onImageUpload?: (file: File) => Promise<string | null>
    /** Replaces `sanitizeHtml` for the value both ways. Only for content the app
     *  trusts; a stored string may otherwise be someone else's script. */
    sanitize?: (html: string) => string
    /** Posts the value with a native form, as a hidden input of this name. */
    name?: string
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
    onImageUpload,
    sanitize,
    name,
  }: Props = $props()

  const clean = (html: string | null | undefined): string => (sanitize ? sanitize(String(html ?? '')) : sanitizeHtml(html))

  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))
  const uid = nextEditorId('sv-rt')
  let editorEl = $state<HTMLDivElement | null>(null)
  let focused = $state(false)
  let empty = $state(true)
  let activeState = $state<Record<string, boolean>>({})
  // The `source` tool: the HTML in a text area, in place of the body.
  let sourceMode = $state(false)
  let sourceText = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)
  // Where the caret was when a dialog (the file picker, a prompt) took focus.
  let savedRange: Range | null = null

  // Push external value into the DOM only when it differs and we're not typing
  // (writing innerHTML while focused would collapse the caret).
  $effect(() => {
    const v = clean(value)
    // A contenteditable owns its own DOM: letting Svelte re-render the body
    // would wipe the caret mid-typing, so the value is pushed in by hand and
    // only while the editor is unfocused.
    // eslint-disable-next-line svelte/no-dom-manipulating
    if (editorEl && !focused && !sourceMode && editorEl.innerHTML !== v) editorEl.innerHTML = asTrustedHtml(v)
    if (editorEl) empty = editorEl.textContent!.trim().length === 0
  })

  function sync() {
    if (!editorEl) return
    const html = clean(editorEl.innerHTML)
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

  function saveRange() {
    const sel = typeof getSelection === 'function' ? getSelection() : null
    savedRange = sel && sel.rangeCount && editorEl && editorEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
  }
  function restoreRange() {
    editorEl?.focus()
    const sel = typeof getSelection === 'function' ? getSelection() : null
    if (sel && savedRange) {
      sel.removeAllRanges()
      sel.addRange(savedRange)
    }
  }
  function insertImage(url: string | null) {
    if (!url) return
    restoreRange()
    exec('insertImage', url)
  }
  function pickImage() {
    if (disabled || readonly) return
    saveRange()
    if (onImageUpload) {
      fileInput?.click()
      return
    }
    const url = typeof prompt === 'function' ? prompt(M.imagePrompt, 'https://') : null
    insertImage(url)
  }
  async function onFilePicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files && input.files[0]
    input.value = ''
    if (!file || !onImageUpload) return
    insertImage(await onImageUpload(file))
  }
  function insertTable() {
    const cells = (tag: string) => `<tr>${`<${tag}><br></${tag}>`.repeat(3)}</tr>`
    exec('insertHTML', `<table><thead>${cells('th')}</thead><tbody>${cells('td')}${cells('td')}</tbody></table><p><br></p>`)
  }
  function toggleSource() {
    if (disabled || readonly) return
    if (!sourceMode) {
      sourceText = value
      sourceMode = true
      return
    }
    // Back to the editor: the HTML as edited, through the sanitizer.
    const html = clean(sourceText)
    sourceMode = false
    value = html
    onChange?.(html)
    // eslint-disable-next-line svelte/no-dom-manipulating
    if (editorEl) editorEl.innerHTML = asTrustedHtml(html)
    if (editorEl) empty = editorEl.textContent!.trim().length === 0
  }
  function onSourceInput() {
    const html = clean(sourceText)
    value = html
    onChange?.(html)
  }

  const run: Record<Exclude<RichTextTool, '|'>, () => void> = {
    bold: () => exec('bold'), italic: () => exec('italic'), underline: () => exec('underline'), strike: () => exec('strikeThrough'),
    h1: () => exec('formatBlock', 'H1'), h2: () => exec('formatBlock', 'H2'), h3: () => exec('formatBlock', 'H3'), p: () => exec('formatBlock', 'P'),
    ul: () => exec('insertUnorderedList'), ol: () => exec('insertOrderedList'),
    quote: () => exec('formatBlock', 'BLOCKQUOTE'), code: () => exec('formatBlock', 'PRE'),
    alignLeft: () => exec('justifyLeft'), alignCenter: () => exec('justifyCenter'), alignRight: () => exec('justifyRight'),
    link: () => { const url = typeof prompt === 'function' ? prompt(M.linkPrompt, 'https://') : null; if (url) exec('createLink', url) },
    clear: () => exec('removeFormat'), undo: () => exec('undo'), redo: () => exec('redo'),
    image: pickImage, table: insertTable, hr: () => exec('insertHorizontalRule'), source: toggleSource,
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
            class:is-on={t === 'source' ? sourceMode : activeState[t]}
            data-tool={t}
            title={M[t]}
            aria-label={M[t]}
            aria-pressed={t === 'source' ? sourceMode : activeState[t] ? true : undefined}
            disabled={disabled || (sourceMode && t !== 'source')}
            onmousedown={(e) => e.preventDefault()}
            onclick={run[t]}
          >{GLYPH[t]}</button>
        {/if}
      {/each}
    </div>
    {#if onImageUpload}
      <input bind:this={fileInput} type="file" accept="image/*" hidden onchange={onFilePicked} />
    {/if}
  {/if}
  {#if name}<input type="hidden" {name} {value} />{/if}
  {#if sourceMode}
    <textarea
      class="sv-rt__source"
      style:min-height={minHeight}
      aria-label={M.source}
      spellcheck="false"
      bind:value={sourceText}
      oninput={onSourceInput}
    ></textarea>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={editorEl}
    id={uid}
    class="sv-rt__body"
    class:is-empty={empty}
    hidden={sourceMode}
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
  .sv-rt__source { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 0; outline: none; resize: vertical; font: 12.5px/1.6 ui-monospace, monospace; color: inherit; background: transparent; }
  .sv-rt__body :global(table) { border-collapse: collapse; margin: 0.4em 0; }
  .sv-rt__body :global(th), .sv-rt__body :global(td) { border: 1px solid var(--sg-border, #cbd5e1); padding: 4px 8px; min-width: 48px; vertical-align: top; }
  .sv-rt__body :global(img) { max-width: 100%; height: auto; }
  .sv-rt__body.is-empty::before { content: attr(data-placeholder); color: var(--sg-muted, #94a3b8); pointer-events: none; }
  .sv-rt__body :global(h1) { font-size: 1.5em; font-weight: 700; margin: 0.4em 0; }
  .sv-rt__body :global(h2) { font-size: 1.25em; font-weight: 700; margin: 0.4em 0; }
  .sv-rt__body :global(h3) { font-size: 1.1em; font-weight: 650; margin: 0.4em 0; }
  .sv-rt__body :global(blockquote) { margin: 0.4em 0; padding-inline-start: 12px; border-inline-start: 3px solid var(--sg-border, #cbd5e1); color: var(--sg-muted, #64748b); }
  .sv-rt__body :global(pre) { margin: 0.4em 0; padding: 10px 12px; border-radius: 8px; background: var(--sg-row-hover-bg, #f1f5f9); font: 12.5px/1.6 ui-monospace, monospace; overflow-x: auto; }
  .sv-rt__body :global(a) { color: var(--_accent); }
  .sv-rt__body :global(ul), .sv-rt__body :global(ol) { margin: 0.4em 0; padding-inline-start: 24px; }
  /* Said outright: a CSS reset (Tailwind's preflight) removes list markers, and a list without them reads as plain lines. */
  .sv-rt__body :global(ul) { list-style: disc; }
  .sv-rt__body :global(ol) { list-style: decimal; }
</style>
