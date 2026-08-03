# SvGrid UI

**SvGrid UI** is the Svelte 5 component suite that ships in the free
`@svgrid/grid` package - 70+ buttons, inputs, pickers, overlays, and layout
primitives, each with its own tutorial page. Every one is **two things at once**:

1. a **standalone control** you can drop into any Svelte app, and
2. a **grid cell editor** - the same component SvGrid mounts when you edit a cell.

That dual nature is the point: the grid stays the flagship, and its editor kit is
also a full component library you can use on its own. Every component is
theme-driven, accessible, and dependency-free (see below). Try them live under the
**SvGrid Editors** switcher in the examples gallery, or jump straight to any
component's tutorial in [the catalogue](#the-catalogue).

> **Quick start with the CLI.** `npx @svgrid/ui try calendar` opens any component
> in a sandbox in your browser; `npx @svgrid/ui add calendar` drops a ready-to-edit
> starter into your app (and installs the dep). See [Add components with the CLI](./cli.md).

![The SvGrid UI suite: nine families of components, each usable standalone and as a grid cell editor.](/docs-media/svgrid-ui-map.svg)

## Design principles

- **Theme-driven.** Every component styles itself from the grid's `--sg-*` theme
  tokens (`--sg-accent`, `--sg-bg`, `--sg-fg`, `--sg-border`, `--sg-radius`,
  `--sg-focus-ring`, ...). Pick any preset theme and the components follow - no
  per-component theming needed.
- **Accessible.** Each control maps to its WAI-ARIA APG pattern (listbox, combobox,
  radiogroup, slider, tabs, tree, ...) with full keyboard support and roving
  tabindex where the pattern calls for it.
- **Controlled or bound.** Components take a `value` and emit `onChange`, and the
  value is `$bindable` - so `<SvTextInput bind:value={name} />` works too (the
  editors, plus `SvMultiSelect` / `SvTreeSelect` / `SvGridSelect`). Overlay controls
  additionally emit `onCommit` / `onCancel` so the grid can save or cancel an edit.
- **Portalled overlays.** Dropdown-style controls render their panel to `<body>`
  (carrying the theme tokens with them) so they are never clipped by the grid's
  scroll container.
- **Dependency-free.** Icons are inline SVG; the date engine, mask engine and
  country data are plain TypeScript. No external UI or date libraries.

## The catalogue

Every component has its own tutorial page - what it is, a live demo, the full
props table, common patterns, and accessibility notes. The overview link on each
group heading is the at-a-glance rollup.

### [Buttons & toggles](./buttons.md)

[SvButton](./sv-button.md) · [SvButtonGroup](./sv-button-group.md) ·
[SvRepeatButton](./sv-repeat-button.md) · [SvToggleButton](./sv-toggle-button.md) ·
[SvSwitchButton](./sv-switch-button.md) · [SvCheckBox](./sv-check-box.md) ·
[SvRadioGroup](./sv-radio-group.md) · [SvRating](./sv-rating.md)

### [Inputs](./inputs.md)

[SvTextInput](./sv-text-input.md) · [SvTextArea](./sv-text-area.md) ·
[SvNumberInput](./sv-number-input.md) · [SvPasswordInput](./sv-password-input.md) ·
[SvMaskedInput](./sv-masked-input.md) · [SvPhoneInput](./sv-phone-input.md) ·
[SvColorInput](./sv-color-input.md) · [SvOtpInput](./sv-otp-input.md) ·
[SvDurationInput](./sv-duration-input.md) · [SvTagsInput](./sv-tags-input.md)

### [Selection](./selection.md)

[SvListBox](./sv-list-box.md) · [SvDropDownList](./sv-drop-down-list.md) ·
[SvComboBox](./sv-combo-box.md) · [SvAutoComplete](./sv-auto-complete.md) ·
[SvMultiSelect](./sv-multi-select.md) · [SvTreeSelect](./sv-tree-select.md) ·
[SvGridSelect](./sv-grid-select.md) · [SvGridDropdown](./sv-grid-dropdown.md) ·
[SvCountryInput](./sv-country-input.md)

### [Date & time](./date-time.md)

[SvCalendar](./sv-calendar.md) · [SvTimePicker](./sv-time-picker.md) ·
[SvDateTimePicker](./sv-date-time-picker.md) · [SvDateRangeInput](./sv-date-range-input.md)

### [Range & meters](./range.md)

[SvSlider](./sv-slider.md) · [SvGauge](./sv-gauge.md) · [SvProgress](./sv-progress.md) ·
[SvCircularProgress](./sv-circular-progress.md) · [SvSparkline](./sv-sparkline.md) ·
[SvStat](./sv-stat.md)

### [Overlays & menus](./overlays.md)

[SvPopover](./sv-popover.md) · [SvTooltip](./sv-tooltip.md) · [SvModal](./sv-modal.md) ·
[SvDrawer](./sv-drawer.md) · [SvToaster](./sv-toaster.md) ·
[SvContextMenu](./sv-context-menu.md) · [SvMenu](./sv-menu.md) · [SvMenuList](./sv-menu-list.md)

### [Layout & composite](./layout.md)

[SvTabs](./sv-tabs.md) · [SvAccordion](./sv-accordion.md) · [SvSplitter](./sv-splitter.md) ·
[SvDockLayout](./sv-dock-layout.md) · [SvDockManager](./sv-dock-manager.md) ·
[SvCard](./sv-card.md) · [SvDivider](./sv-divider.md) · [SvScrollArea](./sv-scroll-area.md) ·
[SvGridChart](./sv-grid-chart.md) · [SvForm](./sv-form.md) · [SvField](./sv-field.md) ·
[SvFileUpload](./sv-file-upload.md)

### [Feedback & display](./feedback.md)

[SvBadge](./sv-badge.md) · [SvSkeleton](./sv-skeleton.md) · [SvAlert](./sv-alert.md) ·
[SvEmptyState](./sv-empty-state.md) · [SvChip](./sv-chip.md) · [SvTimeline](./sv-timeline.md) ·
[SvAvatar](./sv-avatar.md) · [SvAvatarGroup](./sv-avatar-group.md) · [SvCarousel](./sv-carousel.md)

### [Navigation & rich](./navigation.md)

[SvBreadcrumb](./sv-breadcrumb.md) · [SvPagination](./sv-pagination.md) ·
[SvStepper](./sv-stepper.md) · [SvNavPane](./sv-nav-pane.md) · [SvTree](./sv-tree.md) ·
[SvCommand](./sv-command.md) · [SvTour](./sv-tour.md) · [SvRichText](./sv-rich-text.md)

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
`'datetime-native'` or `'time-native'`.

## Custom cell editors

Any component - a built-in `Sv*` control or one you author - can be mounted as a
cell editor by registering it under a type name, then naming that type on a
column. The grid hands it a uniform context: `value` plus `onChange` (update the
in-progress value), `onCommit` (save + stop editing) and `onCancel` (discard).

```svelte
<script>
  import { SvGrid, registerCellEditor, SvRating } from '@svgrid/grid'

  // Map the grid's edit context onto the component's props.
  registerCellEditor('stars', {
    component: SvRating,
    props: (ctx) => ({ value: ctx.value, onChange: (v) => ctx.onCommit(v) }),
  })

  const columns = [{ field: 'score', header: 'Score', editorType: 'stars' }]
</script>
```

`registerCellEditor(type, Component)` uses the default mapping (spreads `value`,
`onChange`, `onCommit`, `onCancel`); pass a `{ component, props }` object for a
custom mapping. Also available: `getCellEditor`, `hasCellEditor`,
`unregisterCellEditor`, `registeredCellEditorTypes`.

**Built-in shortcuts.** Call `registerBuiltinEditors()` once to register the
config-free editors so columns can use them by name straight away:

```ts
import { registerBuiltinEditors } from '@svgrid/grid'
registerBuiltinEditors() // enables editorType 'otp' and 'duration'

const columns = [
  { field: 'code', editorType: 'otp' },
  { field: 'estimate', editorType: 'duration' },
]
```

It's opt-in (so the components tree-shake when unused). Option/structured editors
(`SvMultiSelect`, `SvTreeSelect`, `SvGridSelect`) need their `options`/`nodes`/
`columns`, so register those yourself with a `props` mapping as shown above.
