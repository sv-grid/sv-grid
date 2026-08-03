# SvRichText

A lightweight WYSIWYG editor: a formatting toolbar over a `contentEditable`
region that emits HTML through a bindable `value`.

`SvRichText` covers the common editing commands - bold, italic, underline,
strikethrough, headings, lists, quote, code block, alignment, links, and
undo/redo - in a compact toolbar you can reorder or trim. It emits an HTML string
via `bind:value` and reflects the active formatting state (bold/italic and list
buttons light up with the caret). It uses `document.execCommand`, the pragmatic
approach for a component-kit editor. All color comes from the `--sg-*` tokens.

Related: [Inputs overview](inputs.md) · [SvForm](sv-form.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvRichText` starter into your app:

<div data-docs-add="add rich-text"></div>

Prefer to see it first? `npx @svgrid/ui try rich-text` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvRichText` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvRichText } from '@svgrid/grid'
```

## Example

<div data-docs-demo="341-rich-text-editor" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvRichText } from '@svgrid/grid'
  let html = $state('<p>Hello</p>')
</script>

<SvRichText bind:value={html} placeholder="Write something…" />
```

## Props

| Prop          | Type                        | Default               | Description                                                    |
| ------------- | --------------------------- | --------------------- | -------------------------------------------------------------- |
| `value`       | `string`                    | `''`                  | HTML string (bindable).                                        |
| `onChange`    | `(html: string) => void`    | -                     | Fires with the HTML on every edit.                            |
| `placeholder` | `string`                    | `''`                  | Shown when the editor is empty.                                |
| `disabled`    | `boolean`                   | `false`               | Dims the editor and blocks all input.                         |
| `readonly`    | `boolean`                   | `false`               | Hides the toolbar and makes the body non-editable.            |
| `minHeight`   | `string`                    | `160px`               | Minimum height of the editable body (any CSS length).         |
| `tools`       | `RichTextTool[]`            | full default set      | Toolbar tools and their order; use `'\|'` for a separator.     |
| `ariaLabel`   | `string`                    | `Rich text editor`    | Accessible name for the editable region.                       |

`RichTextTool` (exported) is one of:
`'bold' | 'italic' | 'underline' | 'strike' | 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'quote' | 'code' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'link' | 'clear' | 'undo' | 'redo' | '|'`.
The `'|'` entry draws a visual separator between tool groups.

## Examples

### A trimmed toolbar

Pass just the tools you need; group them with `'|'` separators:

```svelte
<SvRichText
  bind:value={note}
  tools={['bold', 'italic', '|', 'ul', 'ol', '|', 'link']}
/>
```

### Read-only rendering

Set `readonly` to show formatted content without a toolbar - useful for previews
of the same HTML the editor produced:

```svelte
<SvRichText value={savedHtml} readonly />
```

### Reacting to edits

Persist on change instead of only on blur:

```svelte
<SvRichText bind:value={html} onChange={(h) => queueSave(h)} />
```

### A field bound to a record, with preview

Bind `value` straight to a field on your state object so edits flow back into the
model. Track a `dirty` flag from `onChange` to gate the Save button, then flip to
`readonly` to preview the exact HTML the editor produced:

```svelte
<script lang="ts">
  import { SvRichText, SvButton } from '@svgrid/grid'

  let ticket = $state({ id: 42, notes: '<p>Initial triage notes.</p>' })
  let editing = $state(true)
  let dirty = $state(false)

  function save() {
    fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: ticket.notes }),
    })
    dirty = false
    editing = false
  }
</script>

{#if editing}
  <SvRichText
    bind:value={ticket.notes}
    tools={['bold', 'italic', '|', 'ul', 'ol', '|', 'link', 'clear']}
    minHeight="200px"
    placeholder="Add triage notes..."
    onChange={() => (dirty = true)}
  />
  <SvButton variant="primary" disabled={!dirty} onclick={save}>Save</SvButton>
{:else}
  <SvRichText value={ticket.notes} readonly />
  <SvButton onclick={() => (editing = true)}>Edit</SvButton>
{/if}
```

Tip: an external change to `value` is written into the editor only while it is
not focused - writing `innerHTML` mid-caret would collapse the selection - so a
value set from elsewhere applies once the field blurs. `readonly` mode drops the
toolbar and renders the same HTML, making it a zero-cost preview of what you saved.

## Accessibility

- The editable region is a `role="textbox"` with `aria-multiline` and an
  `aria-label`.
- The toolbar is a `role="toolbar"` wired to the body via `aria-controls`.
- Toggle tools (bold, italic, lists) expose `aria-pressed` reflecting the current
  caret state; every button has a descriptive label.

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [Inputs overview](inputs.md) - the text and value editors.
- [SvForm](sv-form.md) - collect rich text alongside other fields.
