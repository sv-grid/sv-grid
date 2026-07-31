# SvTabs

A WAI-ARIA tabs widget with roving-tabindex arrow-key navigation, four tab
positions, and optional closable tabs.

`SvTabs` renders a tab strip plus the active panel through a `panel` snippet. It
is controlled - you own the active id via `value` and `onChange` - and every
color comes from the grid's `--sg-*` tokens, so it matches the rest of the kit in
light and dark. The keyboard behaviour, activation mode, and close handling live
in a headless `createTabs` core; this component is one styled renderer over it.

Related: [SvAccordion](sv-accordion.md) · [SvSplitter](sv-splitter.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvTabs` starter into your app:

<div data-docs-add="add tabs"></div>

Or install the package and import it directly. `SvTabs` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvTabs } from '@svgrid/grid'
```

## Example

<div data-docs-demo="320-tabs" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvTabs, type TabItem } from '@svgrid/grid'
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings', disabled: true },
  ]
  let tab = $state('overview')
</script>

<SvTabs {tabs} value={tab} onChange={(id) => (tab = id)} variant="line">
  {#snippet panel(active)}
    {#if active === 'overview'}<Overview />{:else if active === 'activity'}<Activity />{/if}
  {/snippet}
</SvTabs>
```

## Props

| Prop          | Type                                          | Default       | Description                                                              |
| ------------- | --------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `tabs`        | `ReadonlyArray<TabItem>`                      | -             | The tab items. See [TabItem](#tabitem).                                  |
| `value`       | `string`                                      | -             | Active tab id (bindable). Controlled via `onChange`.                    |
| `onChange`    | `(id: string) => void`                        | -             | Fired when the active tab changes.                                       |
| `onClose`     | `(id: string) => void`                        | -             | Fired when a closable tab's x or the `Delete` key closes it.            |
| `tabPosition` | `top` \| `bottom` \| `left` \| `right`        | `top`         | Where the tab strip sits.                                                |
| `orientation` | `horizontal` \| `vertical`                    | -             | Deprecated. Use `tabPosition` (`horizontal` -> top, `vertical` -> left). |
| `variant`     | `line` \| `pill`                              | `line`        | Underline strip or segmented pill look.                                  |
| `activation`  | `automatic` \| `manual`                       | `automatic`   | Activate on focus, or on `Enter` / `Space`.                             |
| `panel`       | `Snippet<[string]>`                           | -             | Renders the active panel; receives the active id.                       |
| `ariaLabel`   | `string`                                      | -             | Accessible name for the tab list.                                        |
| `dir`         | `EditorDir` (`ltr` \| `rtl` \| `auto`)        | -             | Text direction. `rtl` mirrors layout and flips horizontal arrow keys.   |
| `reorderable` | `boolean`                                      | `false`       | Allow dragging tabs to reorder them.                                     |
| `onReorder`   | `(orderedIds: string[]) => void`              | -             | Fired with the new id order after a drag.                               |

### TabItem

```ts
type TabItem = { id: string; label: string; disabled?: boolean; closable?: boolean }
```

## Examples

### Pill view switcher

Use `variant="pill"` for a compact segmented control - ideal for switching a view
without the weight of full tab chrome:

```svelte
<SvTabs {tabs} value={view} onChange={(id) => (view = id)} variant="pill" ariaLabel="View" />
```

### Closable tabs

Mark items `closable` and handle `onClose` to drop them from your array. The x
button and the `Delete` key both fire it:

```svelte
<SvTabs tabs={openDocs} value={active} onChange={(id) => (active = id)}
  onClose={(id) => (openDocs = openDocs.filter((t) => t.id !== id))} />
```

### Side tabs

Set `tabPosition="left"` (or `right`) for a vertical strip in IDE-style layouts;
arrow keys navigate along the strip's axis automatically.

### Settings page

A full settings screen: one `line` strip switches between account, notification,
and billing panels, each its own component, with the active id held in `$state`:

```svelte
<script lang="ts">
  import { SvTabs, type TabItem } from '@svgrid/grid'
  const tabs: TabItem[] = [
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'billing', label: 'Billing' },
  ]
  let tab = $state('account')
</script>

<SvTabs {tabs} value={tab} onChange={(id) => (tab = id)} ariaLabel="Settings">
  {#snippet panel(active)}
    {#if active === 'account'}<AccountSettings />
    {:else if active === 'notifications'}<NotificationSettings />
    {:else}<BillingSettings />{/if}
  {/snippet}
</SvTabs>
```

**Tip:** the `panel` snippet renders only the active id, so a heavy panel mounts
when its tab activates. Pair `activation="manual"` so arrow-keying past a panel
waits for `Enter` / `Space` instead of eagerly mounting each one.

## Accessibility

- Full WAI-ARIA tabs pattern: `role="tablist"` / `tab` / `tabpanel` with
  `aria-controls` and `aria-selected` wired by the core.
- Roving tabindex: `Tab` enters the strip, arrow keys move between tabs (skipping
  `disabled` ones), `Home` / `End` jump to the ends.
- `activation="manual"` waits for `Enter` / `Space` so arrow-keying past a heavy
  panel does not eagerly load each one.

## See also

- [SvAccordion](sv-accordion.md) - collapsible sections for the same content in a stacked layout.
- [SvSplitter](sv-splitter.md) - resizable panes to compose around a tab set.
- [Layout overview](layout.md) - the whole layout family at a glance.
