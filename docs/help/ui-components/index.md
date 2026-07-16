# UI components (SvGrid Editors)

SvGrid ships a suite of Svelte 5 UI components in the free `@svgrid/grid` package.
Every one is **two things at once**:

1. a **standalone control** you can drop into any app that already uses SvGrid, and
2. a **grid cell editor** - the same component SvGrid mounts when you edit a cell.

They are deliberately not a separate "component suite" product: the grid stays the
hero, and these are its editors, usable on their own. Try them live under the
**SvGrid Editors** switcher in the examples gallery.

## Design principles

- **Theme-driven.** Every component styles itself from the grid's `--sg-*` theme
  tokens (`--sg-accent`, `--sg-bg`, `--sg-fg`, `--sg-border`, `--sg-radius`,
  `--sg-focus-ring`, ...). Pick any preset theme and the components follow - no
  per-component theming needed.
- **Accessible.** Each control maps to its WAI-ARIA APG pattern (listbox, combobox,
  radiogroup, slider, tabs, tree, ...) with full keyboard support and roving
  tabindex where the pattern calls for it.
- **Controlled.** Components take a `value` and emit `onChange`; overlay controls
  additionally emit `onCommit` / `onCancel` so the grid can save or cancel an edit.
- **Portalled overlays.** Dropdown-style controls render their panel to `<body>`
  (carrying the theme tokens with them) so they are never clipped by the grid's
  scroll container.
- **Dependency-free.** Icons are inline SVG; the date engine, mask engine and
  country data are plain TypeScript. No external UI or date libraries.

## The catalogue

| Group | Components |
| --- | --- |
| [Date & time](./date-time.md) | `SvCalendar`, `SvTimePicker`, `SvDateTimePicker` |
| [Buttons & toggles](./buttons.md) | `SvButton`, `SvRepeatButton`, `SvToggleButton`, `SvSwitchButton`, `SvCheckBox`, `SvRadioGroup`, `SvRating` |
| [Inputs](./inputs.md) | `SvNumberInput`, `SvPasswordInput`, `SvMaskedInput`, `SvPhoneInput`, `SvColorInput` |
| [Selection](./selection.md) | `SvListBox`, `SvDropDownList`, `SvComboBox`, `SvAutoComplete`, `SvTagsInput`, `SvCountryInput` |
| [Range & feedback](./range.md) | `SvSlider`, `SvGauge` |
| [Layout & composite](./layout.md) | `SvTabs`, `SvTree`, `SvForm` |

## As grid cell editors

The date/time controls are the **rich-by-default** editors for `date`, `datetime`
and `time` columns:

```svelte
<script>
  import { SvGrid } from '@svgrid/grid'
  const columns = [
    { field: 'due', header: 'Due', editorType: 'date' },      // -> SvCalendar popover
    { field: 'at', header: 'At', editorType: 'datetime' },    // -> SvDateTimePicker
    { field: 'start', header: 'Start', editorType: 'time' },  // -> SvTimePicker dial
  ]
</script>
```

To opt back out to the plain native inputs, use `editorType: 'date-native'`,
`'datetime-native'` or `'time-native'`. Any other control can be wired into a
column via the `cellEditor` snippet.
