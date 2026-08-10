# SvSegmented

A segmented control: a compact row of mutually-exclusive options in a shared
track - the modern alternative to a small radio group or a tab strip for a
setting.

`SvSegmented` renders single-select options as pill buttons in one track. It
reuses the radio-group core, so it is a proper `role="radiogroup"` with arrow-key
roaming and Space/Enter selection, and it themes from the shared `--sg-*` tokens.
Reach for it for view switchers, range pickers, and small enum settings.

Related: [SvRadioGroup](sv-radio-group.md) · [SvButtonGroup](sv-button-group.md) · [SvTabs](sv-tabs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSegmented` starter into your app:

<div data-docs-add="add segmented"></div>

Prefer to see it first? `npx @svgrid/ui try segmented` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvSegmented` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSegmented } from '@svgrid/grid'
```

## Example

<div data-docs-demo="408-segmented" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvSegmented } from '@svgrid/grid'
  let view = $state('board')
</script>

<SvSegmented
  bind:value={view}
  options={[
    { value: 'board', label: 'Board' },
    { value: 'table', label: 'Table' },
    { value: 'calendar', label: 'Calendar' },
  ]}
/>
```

## Props

| Prop        | Type                                   | Default | Description                                                    |
| ----------- | -------------------------------------- | ------- | ------------------------------------------------------------- |
| `options`   | `SegmentedOption[]`                    | -       | The choices: `{ value; label; disabled?; icon? }`.            |
| `value`     | `string \| number \| null`             | `null`  | Selected value (bindable).                                    |
| `onChange`  | `(value) => void`                      | -       | Fires when the selection changes.                             |
| `size`      | `sm` \| `md` \| `lg`                   | `md`    | Control height and font size.                                 |
| `block`     | `boolean`                              | `false` | Stretch full width and split options evenly.                  |
| `disabled`  | `boolean`                              | `false` | Disable the whole control.                                    |
| `label` / `hint` / `error` / `required` | -                  | -       | Optional [SvField](sv-field.md) chrome around the control.    |
| `dir`       | `EditorDir` (`ltr` \| `rtl` \| `auto`) | -       | Text direction.                                               |
| `name`      | `string`                               | -       | Emit a hidden input carrying the value for form posts.        |

`SegmentedOption` is `{ value; label; disabled?; icon?: Snippet }`.

## Examples

### Full width with icons

Set `block` to split the track evenly, and give options an `icon` snippet:

```svelte
<SvSegmented block bind:value={align} options={[
  { value: 'left', label: 'Left', icon: leftIcon },
  { value: 'center', label: 'Center', icon: centerIcon },
  { value: 'right', label: 'Right', icon: rightIcon },
]} />
```

### As a field

Pass `label` / `hint` / `error` to wrap it in the shared field chrome:

```svelte
<SvSegmented label="Billing period" bind:value={period} required
  error={period ? undefined : 'Pick a period'}
  options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
```

## Accessibility

- The control is a `role="radiogroup"` and each option a `role="radio"` with a
  single tab stop and roving `tabindex`.
- Keyboard: Left/Right (and Up/Down) move between options and select them; Space
  or Enter selects the focused option; disabled options are skipped.
- Give it a `label` (or `ariaLabel`) so the group is named for assistive tech.

## See also

- [SvRadioGroup](sv-radio-group.md) - the classic radio list on the same core.
- [SvTabs](sv-tabs.md) - when each option reveals a whole panel of content.
- [SvButtonGroup](sv-button-group.md) - a segmented cluster of action buttons.
