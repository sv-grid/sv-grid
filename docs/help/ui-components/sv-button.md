# SvButton

The press primitive for the whole UI kit - a themeable button with variants,
sizes, a built-in loading state, an icon slot, and automatic anchor rendering
when you pass an `href`.

`SvButton` is the button every other component leans on. It carries no opinion
about your color scheme: every color comes from the grid's `--sg-*` tokens, so
it matches your grid, edit forms, and the rest of the kit out of the box, in
light and dark. It renders a real `<button>` (or an `<a>` when given `href`),
so keyboard focus, `Enter` / `Space` activation, and screen-reader semantics are
the platform's, not a re-implementation.

Related: [SvButtonGroup](sv-button-group.md) · [SvToggleButton](sv-toggle-button.md) · [SvSwitchButton](sv-switch-button.md) · [SvRepeatButton](sv-repeat-button.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvButton` starter into your app:

<div data-docs-add="add button"></div>

Or install the package and import it directly. `SvButton` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvButton } from '@svgrid/grid'
```

## Example

<div data-docs-demo="305-button" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvButton } from '@svgrid/grid'
  let saving = $state(false)
</script>

<SvButton variant="primary" onclick={save}>Save</SvButton>
<SvButton variant="outline">Cancel</SvButton>
<SvButton variant="danger" loading={saving}>Delete</SvButton>
```

## Props

| Prop        | Type                                                        | Default     | Description                                                        |
| ----------- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `variant`   | `primary` \| `secondary` \| `outline` \| `ghost` \| `danger` | `primary`   | Visual weight. `danger` uses the destructive accent.               |
| `size`      | `sm` \| `md` \| `lg`                                        | `md`        | Padding and font size. Shared with the rest of the kit.            |
| `type`      | `button` \| `submit` \| `reset`                             | `button`    | Native button type. Use `submit` inside an [SvForm](sv-form.md).   |
| `disabled`  | `boolean`                                                   | `false`     | Blocks clicks and dims the control.                                |
| `loading`   | `boolean`                                                   | `false`     | Shows a spinner and disables interaction. Keeps the label width.   |
| `block`     | `boolean`                                                   | `false`     | Stretches to the full width of the container.                      |
| `href`      | `string`                                                    | -           | When set, renders an `<a>` styled as a button (a real link).       |
| `ariaLabel` | `string`                                                    | -           | Accessible name for icon-only buttons with no text child.          |
| `onclick`   | `(e: MouseEvent) => void`                                   | -           | Click handler. Suppressed while `disabled` or `loading`.           |
| `icon`      | `Snippet`                                                   | -           | Leading icon slot, rendered before the label.                      |
| `children`  | `Snippet`                                                   | -           | The button label.                                                  |

## Examples

### Icon buttons

Pass an `icon` snippet for a leading glyph, or make an icon-only button by
omitting the label and giving it an `ariaLabel` so it still announces:

```svelte
<SvButton ariaLabel="Add row" onclick={addRow}>
  {#snippet icon()}<PlusIcon />{/snippet}
</SvButton>
```

### Async actions

Drive `loading` from your async handler so the button disables itself for the
duration and can't be double-submitted:

```svelte
<script lang="ts">
  let saving = $state(false)
  async function save() {
    saving = true
    try { await api.save() } finally { saving = false }
  }
</script>

<SvButton variant="primary" loading={saving} onclick={save}>Save</SvButton>
```

### Links that look like buttons

Give `href` and `SvButton` renders an anchor - correct for navigation, so
middle-click and "open in new tab" work:

```svelte
<SvButton variant="outline" href="/reports/export.csv">Download CSV</SvButton>
```

### Full-width form submit

Set `type="submit"` so the button submits its enclosing form, and `block` to
stretch it across a narrow column. Combine with `loading` while the request is
in flight:

```svelte
<form onsubmit={handleSubmit}>
  <!-- fields... -->
  <SvButton type="submit" variant="primary" block loading={saving}>
    Create account
  </SvButton>
</form>
```

**Theming tip:** the fill comes entirely from tokens - `primary` and `outline`
read `--sg-accent` (with `--sg-on-accent` for text), and `danger` reads
`--sg-danger`. Set those on any ancestor to rebrand every button without
touching the component.

## Accessibility

- Renders a native `<button>` (or `<a>` with `href`), so focus, `Tab` order,
  and `Enter` / `Space` activation are the browser's own.
- `disabled` and `loading` set the disabled state; clicks are suppressed even if
  a handler fires.
- Icon-only buttons must set `ariaLabel` - there is no visible text to announce.

## See also

- [SvButtonGroup](sv-button-group.md) - a segmented set of buttons with one selected value.
- [SvToggleButton](sv-toggle-button.md) / [SvSwitchButton](sv-switch-button.md) - on/off controls.
- [SvRepeatButton](sv-repeat-button.md) - fires repeatedly while held.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
