# SvRating

A star rating control built on the WAI-ARIA slider pattern - with hover preview,
keyboard support, optional half steps, and a read-only mode.

`SvRating` collects a score (a product review) or displays an aggregate
(a read-only average with half stars). It is controlled: drive `value` from your
state and update it in `onChange`. It uses the grid's `--sg-rating-*` tokens so a
standalone rating matches the in-grid rating editor, and it carries the shared
editor contract (label, hint, validation, `dir`/RTL) through
[SvField](inputs.md). Star aria-labels are localizable via `messages`.

Related: [SvSwitchButton](sv-switch-button.md) · [SvRadioGroup](sv-radio-group.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvRating` starter into your app:

<div data-docs-add="add rating"></div>

Prefer to see it first? `npx @svgrid/ui try rating` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvRating` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvRating } from '@svgrid/grid'
```

## Example

<div data-docs-demo="311-rating" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvRating } from '@svgrid/grid'
  let score = $state(4)
</script>

<SvRating label="Your rating" value={score} onChange={(v) => (score = v)} />
```

## Props

| Prop        | Type                                | Default | Description                                                        |
| ----------- | ----------------------------------- | ------- | ----------------------------------------------------------------- |
| `value`     | `number`                            | `0`     | Current rating (controlled).                                     |
| `onChange`  | `(value: number) => void`           | -       | Fires with the new rating on pick.                              |
| `max`       | `number`                            | `5`     | Number of stars.                                                |
| `allowHalf` | `boolean`                           | `false` | Allow half-star precision.                                      |
| `readonly`  | `boolean`                           | `false` | Show the value without allowing edits.                         |
| `readOnly`  | `boolean`                           | `false` | Deprecated alias of `readonly`, kept for back-compat.          |
| `disabled`  | `boolean`                           | `false` | Dims the control and blocks interaction.                       |
| `size`      | `sm` \| `md` \| `lg`                | `md`    | Star size.                                                     |
| `name`      | `string`                            | -       | Emits a hidden input carrying the numeric value.               |
| `label`     | `string`                            | -       | Visible field label; also names the group for assistive tech.  |
| `hint`      | `string`                            | -       | Helper text under the stars.                                   |
| `error`     | `string`                            | -       | Error message announced via `aria-describedby`.                |
| `required`  | `boolean`                           | `false` | Adds `aria-required`.                                          |
| `invalid`   | `boolean`                           | `false` | Marks the control invalid.                                    |
| `dir`       | `ltr` \| `rtl` \| `auto`            | `auto`  | Text direction.                                                |
| `ariaLabel` | `string`                            | -       | Accessible name when there is no visible `label`.             |
| `messages`  | `Partial<RatingMessages>`           | -       | Override the built-in strings (group + per-star labels).       |
| `id`        | `string`                            | auto    | Root id; label/hint/error ids derive from it.                  |

Helper type: `RatingMessages = { label: string; star: string; stars: string }` (defaults `Rating` / `star` / `stars`).

## Examples

### Interactive review with a live label

Read `value` back to show the picked score as the user hovers and clicks:

```svelte
<script lang="ts">
  let score = $state(0)
</script>

<SvRating value={score} onChange={(v) => (score = v)} />
<span>{score ? `${score} / 5` : 'Not rated'}</span>
```

### Read-only aggregate with half stars

Combine `readonly` and `allowHalf` to render an average like 4.5:

```svelte
<SvRating readonly allowHalf value={4.5} label="Average rating" />
```

### Localized labels

Override `messages` to translate the group name and per-star announcements:

```svelte
<SvRating value={score} onChange={(v) => (score = v)}
  messages={{ label: 'Bewertung', star: 'Stern', stars: 'Sterne' }} />
```

### Custom scale submitted with a form

`max` is not fixed at five - raise it for a 10-point scale, and give it a `name`
so a plain form submit carries the numeric value in a hidden input:

```svelte
<form>
  <SvRating
    name="nps"
    label="How likely are you to recommend us?"
    max={10}
    value={score}
    onChange={(v) => (score = v)}
  />
</form>
```

**Theming tip:** the stars read `--sg-rating-on` (filled) and
`--sg-rating-empty` (empty), the same tokens as the in-grid rating editor, so a
standalone rating stays visually in sync with one shown in a cell.

## Accessibility

- The control follows the ARIA slider pattern, named by a visible `label`,
  `ariaLabel`, or the `messages.label` fallback.
- Keyboard adjusts the value; each star exposes a label like `3 stars` built
  from `messages.star` / `messages.stars`.
- `readonly` and `disabled` remove the pointer affordance; disabled also dims the
  stars. Half fills render via a per-star gradient so aggregates read precisely.

## See also

- [SvSwitchButton](sv-switch-button.md) - a simple on/off setting.
- [SvRadioGroup](sv-radio-group.md) - pick one option from a labelled set.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
