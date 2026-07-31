# SvSwitchButton

An on/off sliding switch with the ARIA `switch` role - the control for settings
that take effect immediately.

`SvSwitchButton` is the toggle you reach for in a preferences panel: a thumb that
slides across a track, optionally with inline on/off labels. It is controlled -
drive `checked` from your state and update it in `onChange`. Like the rest of the
kit it carries the shared editor contract (label, hint, validation, `dir`/RTL)
through [SvField](inputs.md) and emits a hidden input for form submission when
you give it a `name`.

Related: [SvToggleButton](sv-toggle-button.md) · [SvCheckBox](sv-check-box.md) · [Buttons & toggles overview](buttons.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvSwitchButton` starter into your app:

<div data-docs-add="add switch-button"></div>

Or install the package and import it directly. `SvSwitchButton` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvSwitchButton } from '@svgrid/grid'
```

## Example

<div data-docs-demo="308-switch" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvSwitchButton } from '@svgrid/grid'
  let notify = $state(true)
</script>

<SvSwitchButton
  label="Email notifications"
  checked={notify}
  onChange={(v) => (notify = v)}
/>
```

## Props

| Prop        | Type                         | Default | Description                                                     |
| ----------- | ---------------------------- | ------- | -------------------------------------------------------------- |
| `checked`   | `boolean`                    | `false` | Current on/off state (controlled).                            |
| `onChange`  | `(checked: boolean) => void` | -       | Fires with the next state when toggled.                       |
| `onLabel`   | `string`                     | -       | Optional text shown inside the track when on.                 |
| `offLabel`  | `string`                     | -       | Optional text shown inside the track when off.                |
| `disabled`  | `boolean`                    | `false` | Blocks toggling and dims the control.                         |
| `size`      | `sm` \| `md` \| `lg`         | `md`    | Track and thumb size.                                         |
| `name`      | `string`                     | -       | Emits a hidden input (`true`/`false`) for form submission.    |
| `label`     | `string`                     | -       | Visible field label, rendered above the switch.              |
| `hint`      | `string`                     | -       | Helper text under the switch.                                |
| `error`     | `string`                     | -       | Error message announced via `aria-describedby`.              |
| `required`  | `boolean`                    | `false` | Adds `aria-required`.                                        |
| `invalid`   | `boolean`                    | `false` | Marks the control invalid.                                   |
| `dir`       | `ltr` \| `rtl` \| `auto`     | `auto`  | Text direction; the thumb slides with logical direction.    |
| `ariaLabel` | `string`                     | -       | Accessible name when there is no visible `label`.           |
| `id`        | `string`                     | auto    | Root id; label/hint/error ids derive from it.               |

## Examples

### Settings row

Pair the switch with a `label` and `hint` for a self-describing preferences row:

```svelte
<SvSwitchButton
  label="Two-factor auth"
  hint="Require a code at sign-in"
  checked={mfa}
  onChange={(v) => (mfa = v)}
/>
```

### On/off track labels

Add short `onLabel` / `offLabel` text for a switch that reads its state at a
glance:

```svelte
<SvSwitchButton onLabel="ON" offLabel="OFF" checked={live} onChange={(v) => (live = v)} />
```

### In a form

Give it a `name` and it emits a hidden input, so a plain form submit carries the
value:

```svelte
<form>
  <SvSwitchButton name="marketing" label="Marketing emails" checked={optIn} onChange={(v) => (optIn = v)} />
</form>
```

### Setting that applies immediately

The `switch` role signals a change that takes effect at once, so do the work
right in `onChange` rather than waiting for a save - here, toggling a theme
class on the document root:

```svelte
<script lang="ts">
  import { SvSwitchButton } from '@svgrid/grid'
  let dark = $state(false)
  function setDark(v: boolean) {
    dark = v
    document.documentElement.classList.toggle('dark', v)
  }
</script>

<SvSwitchButton label="Dark mode" checked={dark} onChange={setDark} />
```

## Accessibility

- Renders a `<button role="switch">` with `aria-checked` reflecting `checked`.
- `Enter` and `Space` toggle it; the focus ring lands on the track.
- A visible `label` (or `ariaLabel`) names the switch for assistive tech; the
  on/off labels are decorative.

## See also

- [SvToggleButton](sv-toggle-button.md) - the same on/off state as a pressed button.
- [SvCheckBox](sv-check-box.md) - for opt-in choices submitted with a form.
- [Buttons & toggles overview](buttons.md) - the whole family at a glance.
