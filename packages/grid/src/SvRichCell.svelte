<script lang="ts">
  /**
   * SvRichCell - render rich text inside a grid cell, safely.
   *
   * Pair it with `editorType: 'richtext'` (or feed it Markdown) to get a column
   * whose values carry formatting. The value is always run through
   * `sanitizeHtml` before it is painted, so markup that arrived from a user
   * cannot execute in the host page - see sanitize-html.ts for the allowlist.
   *
   * ```svelte
   * <script>
   *   import { SvRichCell } from '@svgrid/grid'
   * <\/script>
   *
   * {#snippet notesCell({ getValue })}
   *   <SvRichCell value={getValue()} />
   * {/snippet}
   * ```
   *
   * A grid row is one line tall by default, so the content is clamped to
   * `clamp` lines with an ellipsis and the full text goes on the `title`
   * attribute. Set `clamp={0}` in a master/detail panel or a tall row where the
   * whole value should show.
   */
  import { sanitizeHtml, renderMarkdown, htmlToText } from './sanitize-html'

  type Props = {
    /** The cell value: an HTML string, or Markdown when `format="markdown"`. */
    value?: unknown
    /** How to read `value`. Markdown is converted first, then sanitized. */
    format?: 'html' | 'markdown'
    /** Lines to clamp to. 0 removes the clamp and lets the content wrap. */
    clamp?: number
    /** Native tooltip carrying the flattened text. Off when the grid already
     *  supplies its own cell tooltip. */
    title?: boolean
    class?: string
  }

  let { value = '', format = 'html', clamp = 1, title = true, class: className = '' }: Props = $props()

  const source = $derived(value == null ? '' : String(value))
  const html = $derived(format === 'markdown' ? renderMarkdown(source) : sanitizeHtml(source))
  // The flattened text doubles as the tooltip and as the accessible name when
  // the markup collapses to something a screen reader would read as noise.
  const text = $derived(title ? htmlToText(html) : '')
</script>

<div
  class="sv-rich-cell {className}"
  class:is-clamped={clamp > 0}
  style={clamp > 0 ? `--sv-rich-cell-lines: ${clamp}` : undefined}
  title={text || undefined}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</div>

<style>
  .sv-rich-cell {
    min-width: 0;
    color: var(--sg-fg, #0f172a);
    font: inherit;
  }
  /* Clamp to N lines. The grid row is a single line tall by default, so
     unclamped rich text would push the row open and break virtualization's
     fixed-height assumption. */
  .sv-rich-cell.is-clamped {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--sv-rich-cell-lines, 1);
    line-clamp: var(--sv-rich-cell-lines, 1);
    overflow: hidden;
  }
  /* Block elements inside a cell must not carry their document margins, or a
     single <p> pushes the text out of the row box. */
  .sv-rich-cell :global(p),
  .sv-rich-cell :global(h1),
  .sv-rich-cell :global(h2),
  .sv-rich-cell :global(h3),
  .sv-rich-cell :global(h4),
  .sv-rich-cell :global(h5),
  .sv-rich-cell :global(h6),
  .sv-rich-cell :global(ul),
  .sv-rich-cell :global(ol),
  .sv-rich-cell :global(blockquote),
  .sv-rich-cell :global(pre) {
    margin: 0;
    padding: 0;
  }
  .sv-rich-cell.is-clamped :global(ul),
  .sv-rich-cell.is-clamped :global(ol) {
    list-style-position: inside;
  }
  /* Headings keep their weight but drop to cell size: a real <h1> inside a row
     would dwarf every neighbouring cell. */
  .sv-rich-cell :global(h1),
  .sv-rich-cell :global(h2),
  .sv-rich-cell :global(h3),
  .sv-rich-cell :global(h4),
  .sv-rich-cell :global(h5),
  .sv-rich-cell :global(h6) {
    font-size: inherit;
    font-weight: 650;
  }
  .sv-rich-cell :global(a) {
    color: var(--sg-accent, #2563eb);
  }
  .sv-rich-cell :global(code) {
    font-family: var(--sg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.92em;
    background: var(--sg-code-bg, color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent));
    border-radius: var(--sg-radius-sm, 4px);
    padding: 0 4px;
  }
  .sv-rich-cell :global(blockquote) {
    border-inline-start: 2px solid var(--sg-border, #cbd5e1);
    padding-inline-start: 8px;
    color: var(--sg-muted, #64748b);
  }
  .sv-rich-cell :global(img) {
    max-height: 1.4em;
    vertical-align: text-bottom;
  }
</style>
