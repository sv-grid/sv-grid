# Rich text and Markdown cells

Some columns hold formatted text: a note with a bold phrase and a link, a
description written in Markdown, a comment pasted out of another system. Render
those with `SvRichCell`, which sanitizes the value before painting it.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvRichCell, renderSnippet, type ColumnDef } from '@svgrid/grid'

  type Note = { id: number; author: string; body: string }

  const rows: Note[] = [
    { id: 1, author: 'Ada', body: '<p>Shipped the <strong>parser</strong> - see <a href="/docs/">docs</a>.</p>' },
    { id: 2, author: 'Linus', body: '<p>Reverted <code>a1b2c3</code>, the build was red.</p>' },
  ]
</script>
```

## Rendering

`SvRichCell` takes the value, sanitizes it, and paints the result:

```svelte
{#snippet bodyCell({ getValue })}
  <SvRichCell value={getValue()} />
{/snippet}

<SvGrid {rows} columns={[
  { field: 'author', header: 'Author' },
  { field: 'body', header: 'Note', cell: renderSnippet(bodyCell) },
]} />
```

A grid row is one line tall, so the content is clamped to a single line with an
ellipsis and the flattened text goes onto the `title` attribute. Give it more
room with `clamp`, or turn the clamp off entirely inside a master/detail panel:

```svelte
<SvRichCell value={getValue()} clamp={3} />
<SvRichCell value={getValue()} clamp={0} />
```

Set `clamp={0}` only where the row can actually grow. With a fixed row height
the overflow is hidden, and with `rowHeight` as a function the row has to be
tall enough for the content.

## Markdown

Pass `format="markdown"` for values stored as Markdown source rather than HTML:

```svelte
<SvRichCell value={getValue()} format="markdown" />
```

This covers the common subset - headings, `**bold**`, `*italic*`, `~~strike~~`,
`` `code` ``, links, images, and bullet or ordered lists. It is not a full
CommonMark parser: a cell shows a line or two, and a complete parser is a
dependency the package does not take. For full Markdown, convert with your own
library and pass the resulting HTML.

## Editing

`registerBuiltinEditors()` registers `richtext`, which edits the value with
`SvRichText`:

```svelte
<script lang="ts">
  import { registerBuiltinEditors } from '@svgrid/grid'
  registerBuiltinEditors()
</script>

<SvGrid {rows} columns={[
  { field: 'body', header: 'Note', editorType: 'richtext', cell: renderSnippet(bodyCell) },
]} />
```

The editor carries a formatting toolbar, so give the column a taller row or edit
it from a detail panel rather than a default single-line row.

## Sanitization

Everything `SvRichCell` paints goes through `sanitizeHtml` first, and the
`richtext` editor sanitizes both the value it receives and the value it commits.
Cleaning on the way in means pasted markup never reaches your row data.

The allowlist is deliberately narrow - the tags `SvRichText` produces, plus
links and images. Dropped:

- `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>` and their contents
- every `on*` event handler attribute
- `style` attributes, which are the classic sanitizer hole
- `javascript:` and `vbscript:` URLs, including whitespace-obfuscated forms
- `data:` URLs, except base64 images on an `<img src>`

Unknown tags are unwrapped rather than dropped, so an unrecognized wrapper never
costs you the text inside it. A link with `target` gets `rel="noopener
noreferrer"` added.

Call it directly when you need the same guarantee elsewhere:

```ts
import { sanitizeHtml, renderMarkdown, htmlToText } from '@svgrid/grid'

sanitizeHtml('<p onclick="steal()">hi</p>')  // '<p>hi</p>'
renderMarkdown('**bold** and [a link](https://svgrid.com)')
htmlToText('<p>one</p><p>two</p>')           // 'one two'
```

`htmlToText` is what you want for exports, tooltips and accessible names, where
a cell's markup has to collapse to one plain string.

> `sanitizeHtml` is a narrow allowlist for cell content, not a general-purpose
> sanitizer for arbitrary third-party HTML. If you are rendering untrusted
> documents rather than cell values, use a dedicated library.

## Server rendering

During SSR there is no DOM to parse with, so a stricter regex pass runs instead:
allowlisted tags survive, but every attribute is stripped. The markup is plainer
for one paint, and the client re-sanitizes with the real parser on hydration.
