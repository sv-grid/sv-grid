# SvCommand

A Cmd+K command palette: a fuzzy-searchable list of actions in a centered,
focus-trapped dialog, with an optional global hotkey.

`SvCommand` is the keyboard-driven launcher that power users expect. It filters a
flat list of commands with a fuzzy matcher, groups them under headers, shows
per-command shortcut hints, and runs the chosen action. It is built on the shared
a11y primitives (portal, focus trap, scroll lock, dismissable layer) and emits
WAI-ARIA combobox markup with `aria-activedescendant`. By default it binds
Cmd/Ctrl+K to toggle itself, so you can mount it once at the app root.

Related: [SvTour](sv-tour.md) · [SvNavPane](sv-nav-pane.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCommand` starter into your app:

<div data-docs-add="add command"></div>

Prefer to see it first? `npx @svgrid/ui try command` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCommand` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvCommand } from '@svgrid/grid'
```

## Example

<div data-docs-demo="340-command-palette" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvCommand, type CommandItem } from '@svgrid/grid'
  const commands: CommandItem[] = [
    { id: 'new', label: 'New record', group: 'Actions', shortcut: '⌘N', onRun: create },
    { id: 'export', label: 'Export CSV', group: 'Actions', onRun: exportCsv },
  ]
</script>

<SvCommand {commands} onRun={(c) => track(c.id)} />  <!-- Cmd/Ctrl+K opens it -->
```

## Props

| Prop          | Type                            | Default                        | Description                                                    |
| ------------- | ------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| `open`        | `boolean`                       | `false`                        | Whether the palette is shown (bindable).                       |
| `onClose`     | `() => void`                    | -                              | Fires when the palette closes.                                 |
| `commands`    | `ReadonlyArray<CommandItem>`    | -                              | The actions to search and run.                                 |
| `onRun`       | `(cmd: CommandItem) => void`    | -                              | Fires when a command is chosen (before its own `onRun`).       |
| `placeholder` | `string`                        | `Type a command or search…`    | Search-input placeholder.                                      |
| `emptyText`   | `string`                        | `No results`                   | Shown when nothing matches.                                    |
| `hotkey`      | `mod+k` \| `mod+p` \| `false`   | `mod+k`                        | Global toggle hotkey; `false` disables it.                     |

`CommandItem` (exported): `{ id, label, hint?, group?, icon?, shortcut?, keywords?, disabled?, onRun? }`.
`group` becomes a section header, `hint` is a right-aligned description,
`shortcut` shows a key hint, `keywords` adds extra searchable terms, and each
item's own `onRun` fires when it is chosen.

## Examples

### Grouping and shortcuts

Give commands a `group` and a `shortcut`; groups render as headers when the query
is empty, and shortcuts show on the right:

```svelte
const commands = [
  { id: 'save', label: 'Save', group: 'File', shortcut: '⌘S', onRun: save },
  { id: 'open', label: 'Open…', group: 'File', shortcut: '⌘O', onRun: open },
]
```

### Controlled open state

Bind `open` to drive the palette from a toolbar button as well as the hotkey:

```svelte
<SvButton onclick={() => (paletteOpen = true)}>Commands</SvButton>
<SvCommand bind:open={paletteOpen} {commands} />
```

### Extra search terms

Add `keywords` so a command surfaces under words that are not in its label:

```svelte
{ id: 'theme', label: 'Toggle dark mode', keywords: 'appearance color scheme', onRun: toggle }
```

### A palette wired to real actions

Mount `SvCommand` once at the app root and Cmd/Ctrl+K opens it anywhere. Mix
navigation and actions, group them, add `keywords` for terms not in the label,
and gate admin-only entries with `disabled`:

```svelte
<script lang="ts">
  import { SvCommand, type CommandItem } from '@svgrid/grid'
  import { goto } from '$app/navigation'

  let theme = $state<'light' | 'dark'>('light')

  const commands: CommandItem[] = [
    { id: 'go-dashboard', label: 'Go to Dashboard', group: 'Navigate', icon: '📊', onRun: () => goto('/') },
    { id: 'go-orders', label: 'Go to Orders', group: 'Navigate', keywords: 'sales invoices', onRun: () => goto('/orders') },
    { id: 'new', label: 'New order', group: 'Actions', shortcut: '⌘N', onRun: createOrder },
    { id: 'theme', label: 'Toggle dark mode', group: 'Actions', keywords: 'appearance color scheme',
      onRun: () => (theme = theme === 'dark' ? 'light' : 'dark') },
    { id: 'billing', label: 'Open billing', group: 'Actions', hint: 'Admins only', disabled: !isAdmin,
      onRun: () => goto('/billing') },
  ]
</script>

<SvCommand {commands} onRun={(c) => analytics.track('command', c.id)} />
```

Tip: the top-level `onRun` prop fires first, then the chosen command's own
`onRun` - so use the prop for cross-cutting concerns (analytics, closing a menu)
and each item's `onRun` for its actual action. `disabled` commands are filtered
out of the results entirely, so they never surface in search.

## Accessibility

- Renders a `role="dialog"` with `aria-modal`, focus-trapped and scroll-locked
  while open.
- The input is a `role="combobox"`; the list is a `role="listbox"` and the active
  option is tracked with `aria-activedescendant`.
- Arrow Up / Down move the active option, Enter runs it, Escape and outside-click
  dismiss (owned by the shared dismissable layer).

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvTour](sv-tour.md) - guide new users through the UI.
- [SvNavPane](sv-nav-pane.md) - the persistent app-shell sidebar.
