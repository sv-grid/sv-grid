# SvTextArea

The multi-line text editor - with optional auto-grow and a character counter.

`SvTextArea` is `SvTextInput`'s multi-line sibling for notes, descriptions, and
comments. It sits on the shared editor contract, so its label, hint, and error
chrome come from [SvField](sv-field.md) and match the rest of the kit in light
and dark. As a grid cell editor its interaction differs from single-line fields:
a bare `Enter` inserts a newline, `Ctrl` / `Cmd` + `Enter` commits, and `Escape`
cancels.

<div data-docs-demo="334-input-editors" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvTextArea } from '@svgrid/grid'
  let notes = $state('')
</script>

<SvTextArea
  label="Notes"
  placeholder="Anything the team should know…"
  bind:value={notes}
  autoGrow
  maxlength={280}
  showCount
/>
```

## Props

`SvTextArea` extends the shared `SvEditorProps` (`disabled`, `readonly`,
`required`, `invalid`, `error`, `label`, `hint`, `size`, `dir`, `name`, `id`,
`ariaLabel`) and adds:

| Prop          | Type                       | Default | Description                                                   |
| ------------- | -------------------------- | ------- | ------------------------------------------------------------- |
| `value`       | `string`                   | `''`    | The text value. Bindable with `bind:value`.                   |
| `onChange`    | `(value: string) => void`  | -       | Fires on every input.                                         |
| `onCommit`    | `(value: string) => void`  | -       | Fires on `Ctrl` / `Cmd` + `Enter`.                            |
| `onCancel`    | `() => void`               | -       | Fires on `Escape`.                                            |
| `placeholder` | `string`                   | -       | Empty-state hint text.                                        |
| `rows`        | `number`                   | `3`     | Initial visible rows.                                         |
| `maxlength`   | `number`                   | -       | Hard character cap; required for the counter.                 |
| `autoGrow`    | `boolean`                  | `false` | Grow the box to fit content instead of scrolling.             |
| `showCount`   | `boolean`                  | `false` | Show an "n / max" counter (needs `maxlength`).                |
| `autofocus`   | `boolean`                  | `false` | Focus + select on mount (used as a cell editor).             |

## Patterns

### Auto-grow with a counter

Combine `autoGrow`, `maxlength`, and `showCount` for a comment box that expands
as the user types and shows how much room is left:

```svelte
<SvTextArea bind:value={comment} autoGrow maxlength={500} showCount />
```

### Fixed height

Leave `autoGrow` off and set `rows`; the box stays put and scrolls internally.
The user can still drag the native resize handle.

```svelte
<SvTextArea label="Address" rows={4} bind:value={address} />
```

### Required note with a minimum length

Pair `required` with a `$derived` length check so the field asks for enough
detail, and keep `showCount` so the user sees the cap while typing:

```svelte
<script lang="ts">
  import { SvTextArea } from '@svgrid/grid'
  let reason = $state('')
  const tooShort = $derived(reason.trim().length > 0 && reason.trim().length < 20)
</script>

<SvTextArea
  label="Reason for refund"
  required
  rows={4}
  maxlength={500}
  showCount
  bind:value={reason}
  invalid={tooShort}
  error={tooShort ? 'Please give at least 20 characters' : undefined}
/>
```

Tip: the counter only renders when `maxlength` is set, so `showCount` on its own
does nothing - always pass both together.

## Accessibility

- Renders a native `<textarea>`; focus and typing are the platform's own.
- `label`, `hint`, and `error` are wired via `for`/`id` and `aria-describedby`
  by [SvField](sv-field.md); `required` and `invalid` add the matching ARIA.
- The character counter is `aria-hidden`, so it does not spam screen readers on
  every keystroke.

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvTextInput](sv-text-input.md) - the single-line sibling.
- [SvOtpInput](sv-otp-input.md) - segmented code entry.
