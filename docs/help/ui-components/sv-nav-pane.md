# SvNavPane

An Outlook-style navigation pane: collapsible sections, items with icons and
badge counts, one level of nested sub-items, and an optional bottom module strip.

`SvNavPane` is the app-shell sidebar. Sections group items and can collapse;
items carry an icon, a badge (unread counts), and optionally one level of
children. It supports a single-select highlight, arrow-key navigation, an
icon-only `collapsed` rail, and RTL. The bottom `modules` strip reproduces
Outlook's Mail / Calendar / People switch, complete with a drag splitter that
moves modules between full rows and an icon rail. Colors come from the `--sg-*`
tokens.

Related: [SvTree](sv-tree.md) · [SvBreadcrumb](sv-breadcrumb.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvNavPane` starter into your app:

<div data-docs-add="add nav-pane"></div>

Prefer to see it first? `npx @svgrid/ui try nav-pane` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvNavPane` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvButton, SvNavPane } from '@svgrid/grid'
</script>
```

```ts
import { SvNavPane } from '@svgrid/grid'
```

## Example

<div data-docs-demo="327-navpane" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvNavPane, type NavSection } from '@svgrid/grid'
  let value = $state<string | null>('inbox')
  const sections: NavSection[] = [
    { id: 'mail', label: 'Mail', items: [
      { id: 'inbox', label: 'Inbox', badge: 12 },
      { id: 'sent', label: 'Sent' },
    ] },
  ]
</script>

<SvNavPane {sections} bind:value onSelect={(id) => load(id)} />
```

## Props

| Prop               | Type                            | Default        | Description                                                       |
| ------------------ | ------------------------------- | -------------- | ---------------------------------------------------------------- |
| `sections`         | `ReadonlyArray<NavSection>`     | -              | The grouped navigation items.                                    |
| `value`            | `string \| null`                | `null`         | Selected item id (bindable).                                     |
| `onSelect`         | `(id: string) => void`          | -              | Fires when a leaf item is chosen.                                |
| `expandedSections` | `string[]`                      | all open       | Open section ids (bindable). Default opens every section.        |
| `expandedItems`    | `string[]`                      | `[]`           | Open nested-item ids (bindable).                                 |
| `collapsed`        | `boolean`                       | `false`        | Icon-only rail; labels and badges hidden.                        |
| `ariaLabel`        | `string`                        | `Navigation`   | Accessible name for the `<nav>` landmark.                        |
| `dir`              | `EditorDir`                     | -              | Text direction; `rtl` mirrors the pane.                          |
| `modules`          | `ReadonlyArray<NavModule>`      | -              | Outlook-style bottom module buttons.                             |
| `moduleValue`      | `string \| null`                | `null`         | Selected module id (bindable).                                   |
| `onModuleSelect`   | `(id: string) => void`          | -              | Fires when a module is chosen.                                   |
| `moduleRows`       | `number`                        | all            | How many modules show as full rows; the rest collapse to a rail (bindable). |
| `height`           | `number`                        | -              | Pane height in px; lets the module splitter redistribute space.  |

Exported helper types:
- `NavItem`: `{ id, label, icon?: Snippet, badge?: string | number, disabled?, children?: NavItem[] }`.
- `NavSection`: `{ id, label?, items: NavItem[], collapsible? }`.
- `NavModule`: `{ id, label, icon?: Snippet, badge?: string | number }`.

## Examples

### Icons and badge counts

Pass a `Snippet` per item for an icon, and a `badge` for a count:

```svelte
{#snippet inboxIcon()}<MailIcon />{/snippet}
const items = [{ id: 'inbox', label: 'Inbox', icon: inboxIcon, badge: 12 }]
```

### Collapsible icon rail

Bind `collapsed` to a toggle for a slim, icon-only sidebar. Item labels move into
`title` tooltips automatically:

```svelte
<SvNavPane {sections} bind:value collapsed={railOpen} />
```

### The Outlook module strip

Give `modules` and a fixed `height`, then the drag splitter lets the user pull
modules between labelled rows and the compact icon rail (bindable `moduleRows`):

```svelte
<SvNavPane {sections} bind:value {modules} bind:moduleValue height={520} />
```

### A workspace sidebar wired to routing

A full app-shell pane: labelled sections, an icon and unread badge, one level of
nested folders, a disabled item, and a collapse toggle. Route on `onSelect` and
bind `value` so the highlight follows the active page:

```svelte
<script lang="ts">
  import { SvNavPane, SvButton, type NavSection } from '@svgrid/grid'
  import { goto } from '$app/navigation'

  let value = $state<string | null>('inbox')
  let rail = $state(false)

  const sections: NavSection[] = [
    { id: 'mail', label: 'Mail', items: [
      { id: 'inbox', label: 'Inbox', icon: inboxIcon, badge: 12 },
      { id: 'drafts', label: 'Drafts', badge: 3 },
      { id: 'folders', label: 'Folders', children: [
        { id: 'work', label: 'Work' },
        { id: 'personal', label: 'Personal' },
      ] },
    ] },
    { id: 'settings', label: 'Settings', collapsible: true, items: [
      { id: 'account', label: 'Account' },
      { id: 'billing', label: 'Billing', disabled: true },
    ] },
  ]
</script>

{#snippet inboxIcon()}<span>📥</span>{/snippet}

<SvButton size="sm" onclick={() => (rail = !rail)}>{rail ? 'Expand' : 'Collapse'}</SvButton>
<SvNavPane {sections} bind:value collapsed={rail} onSelect={(id) => goto(`/mail/${id}`)} />
```

Tip: an item that has `children` toggles its sub-list on click instead of
selecting, so a parent item never becomes the highlighted `value` and never
fires `onSelect`. Give routable destinations to the leaf items (`work`,
`personal`), not to the folder that contains them.

## Accessibility

- Renders a `<nav aria-label>` landmark; each item and module is a `<button>`.
- The selected item and module carry `aria-current="page"`.
- Section headers and expandable items expose `aria-expanded`.
- Arrow Up / Down move focus between items; the module splitter is a focusable
  `separator` with `aria-valuenow` that Arrow Up / Down resize.

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvTree](sv-tree.md) - a hierarchical tree view for deeper structures.
- [SvBreadcrumb](sv-breadcrumb.md) - show the path to the current page.
