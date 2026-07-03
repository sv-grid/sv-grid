# Full-row editing

Full-row editing opens an **entire row** for edit at once: every editable cell
shows an inline editor, a single Enter (or clicking away) commits all of them in
one update, and Esc cancels the whole row. It's a form-style entry experience
with the density of a grid.

## Enable it

Set `fullRowEditing` (alongside `enableInlineEditing`) on `<SvGrid>`:

```svelte
<SvGrid {data} {columns} enableInlineEditing fullRowEditing />
```

- **Double-click a row** (or `F2` / Enter on a focused cell) to enter full-row edit.
- **Enter** or **click away** commits every drafted cell in a single update
  (one re-render; `onCellValueChange` fires once per changed cell; each change
  is captured in the undo history).
- **Esc** cancels the whole row - nothing is written.

<div data-docs-demo="177-full-row-editing" data-height="520"></div>

## Supported editors

The full-row editor renders a lightweight inline control per editable column:

| `editorType` | Control |
| --- | --- |
| `text` / `password` | text / password input |
| `number` | number input |
| `date` / `datetime` / `time` | native date / datetime-local / time input |
| `checkbox` | checkbox |
| `list` / `select` / `rich-select` | single-select dropdown from `editorOptions` |

Per-column `valueParser` still runs on commit, so the same normalization you use
for single-cell edits applies to full-row commits too.

> Rich single-cell editors (chips multi-select, star rating, color, custom
> `cellEditor` snippets) render in **cell** editing. In full-row mode those
> columns fall back to a text input - use cell editing for a column that needs a
> bespoke control.

## Cell vs full-row editing

Leave `fullRowEditing` off (the default) for classic **cell** editing: a
double-click edits one cell, Tab moves to the next. Turn it on when your users
think in records - onboarding forms, roster edits, CRUD tables - and want to
fill or fix a whole row before saving.

## See also

- [Start / stop editing](./start-stop-editing.md)
- [Parsing values](./parsing-values.md)
- [Validation](./validation.md)
