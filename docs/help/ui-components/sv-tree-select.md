# SvTreeSelect

A single-select dropdown that shows an indented, collapsible tree in its panel -
the cascader / tree-select pattern. Pick a node from a hierarchy, optionally
showing its full path in the trigger.

`SvTreeSelect` covers hierarchical choice (a category, a folder, an org unit)
without pulling in the full [SvTree](navigation.md). It supports `bind:value`,
tracks its own expand/collapse state (seeded from `expandedIds`), and flattens the
visible nodes for a roving-focus keyboard model where `ArrowRight` / `ArrowLeft`
expand and collapse branches. The panel portals out of any scroll container and
colors follow the grid's `--sg-*` tokens.

Related: [SvDropDownList](sv-drop-down-list.md) · [SvGridSelect](sv-grid-select.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvTreeSelect` starter into your app:

<div data-docs-add="add tree-select"></div>

Or install the package and import it directly. `SvTreeSelect` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvTreeSelect } from '@svgrid/grid'
```

## Example

<div data-docs-demo="335-tree-select" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvTreeSelect, type TreeSelectNode } from '@svgrid/grid'
  const nodes: TreeSelectNode[] = [
    { value: 'eng', label: 'Engineering', children: [
      { value: 'fe', label: 'Frontend' },
      { value: 'be', label: 'Backend' },
    ] },
    { value: 'design', label: 'Design' },
  ]
  let value = $state<string | number | null>(null)
</script>

<SvTreeSelect label="Team" {nodes} bind:value showPath />
```

## Props

| Prop          | Type                                    | Default     | Description                                                     |
| ------------- | --------------------------------------- | ----------- | -------------------------------------------------------------- |
| `nodes`       | `ReadonlyArray<TreeSelectNode>`         | -           | The hierarchy to choose from.                                  |
| `value`       | `string \| number \| null`              | `null`      | The selected node's value. Bindable (`bind:value`).            |
| `onChange`    | `(value: string \| number) => void`     | -           | Fires with the picked node's value.                            |
| `onCommit`    | `(value: string \| number) => void`     | -           | Fires when a node is committed.                                |
| `onCancel`    | `() => void`                            | -           | Fires when the panel is dismissed.                             |
| `placeholder` | `string`                               | `'Select…'` | Shown when nothing is selected.                                |
| `showPath`    | `boolean`                              | `false`     | Show the full node path (`A / B / C`) in the trigger.          |
| `expandedIds` | `ReadonlyArray<string \| number>`       | `[]`        | Node values expanded on first open.                            |
| `size`        | `sm \| md \| lg`                       | `md`        | Trigger height and font size.                                  |
| `disabled`    | `boolean`                              | `false`     | Blocks interaction.                                            |
| `label`       | `string`                               | -           | Visible field label, wired to the control.                     |
| `hint`        | `string`                               | -           | Helper text under the control.                                 |
| `error`       | `string`                               | -           | Error message; announced and styled when set.                  |
| `required`    | `boolean`                              | `false`     | Marks the field required.                                      |
| `invalid`     | `boolean`                              | `false`     | Applies the invalid state.                                     |
| `name`        | `string`                               | -           | Emits a hidden input carrying the value for form posts.        |
| `dir`         | `ltr \| rtl \| auto`                   | `auto`      | Text direction.                                               |
| `ariaLabel`   | `string`                               | -           | Accessible name when there is no visible `label`.              |
| `id`          | `string`                               | -           | Root id; label/hint/error ids derive from it.                  |

### TreeSelectNode

```ts
type TreeSelectNode = {
  value: string | number
  label: string
  children?: TreeSelectNode[]
  disabled?: boolean
}
```

## Examples

### Full-path trigger

Turn on `showPath` so the trigger reads `Engineering / Frontend` instead of just
the leaf label - useful when leaf names repeat across branches.

### Pre-expanded branches

Seed the open state so users land deep in the tree without clicking down to it:

```svelte
<SvTreeSelect {nodes} bind:value expandedIds={['eng']} />
```

### Disabled branches

Set `disabled` on a node to make it unpickable while still showing (and expanding)
its children.

### Build the tree from flat rows

Hierarchies usually arrive flat (a `parentId` column). Fold them into
`TreeSelectNode[]` once, then bind the selected leaf:

```svelte
<script lang="ts">
  import { SvTreeSelect, type TreeSelectNode } from '@svgrid/grid'
  const flat = [
    { id: 'eng', parent: null, name: 'Engineering' },
    { id: 'fe', parent: 'eng', name: 'Frontend' },
    { id: 'be', parent: 'eng', name: 'Backend' },
    { id: 'design', parent: null, name: 'Design' },
  ]
  function toTree(parent: string | null): TreeSelectNode[] {
    return flat
      .filter((r) => r.parent === parent)
      .map((r) => ({ value: r.id, label: r.name, children: toTree(r.id) }))
  }
  const nodes = toTree(null)
  let value = $state<string | number | null>(null)
</script>

<SvTreeSelect label="Team" {nodes} bind:value showPath />
```

> Tip: `expandedIds` only seeds the open branches for the first open; after that
> the component tracks its own expand/collapse state, so you do not have to keep
> the prop in sync.

## Accessibility

- The panel is a `role="tree"` of `role="treeitem"` rows with `aria-expanded` and
  `aria-selected`; the active row is tracked via `aria-activedescendant`.
- `ArrowUp` / `ArrowDown` move, `ArrowRight` / `ArrowLeft` expand / collapse,
  `Enter` picks a leaf, `Escape` dismisses, and focus returns to the trigger.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvDropDownList](sv-drop-down-list.md) - a flat single-select dropdown.
- [SvGridSelect](sv-grid-select.md) - pick a row across multiple columns.
