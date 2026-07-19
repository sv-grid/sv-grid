# Headless editors

Every editor is **headless-first**, exactly like the grid (`createSvGrid` /
`<SvGrid>`). Each `Sv*` component is a thin styled renderer over a framework-free
runes core named `create<Editor>`. Import the core to render your own markup with
the kit's state machine, keyboard handling and ARIA - and none of its styles.

## The pattern

A core is a factory that takes **reactive getters** for its inputs and returns
reactive state, actions, and **prop-getters** you spread onto your own elements.

```svelte
<script lang="ts">
  import { createListbox } from '@svgrid/grid'

  let value = $state<string | null>(null)
  const options = [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
  ]

  // Reactive inputs are getters; callbacks are closures.
  const lb = createListbox({
    options: () => options,
    value: () => value,
    onChange: (v) => (value = v),
  })
</script>

<!-- Your markup, the kit's behavior (roving focus, keyboard, aria-*) -->
<ul {...lb.rootProps()}>
  {#each options as opt, i (opt.value)}
    <li {...lb.optionProps(i)} class:mine-selected={lb.isSelected(opt.value)}>
      {opt.label}
    </li>
  {/each}
</ul>
```

`rootProps()` / `optionProps(i)` return attribute + event bundles (including
`role`, `aria-*`, `tabindex`, and the `onkeydown`/`onclick` handlers). Spread
them and you get the full WAI-ARIA listbox behavior on your own DOM.

## What lives where

- **The core** owns state, selection/parse/format math, keyboard, and ARIA. It
  never touches the DOM.
- **The styled component** owns rendering concerns only: the `--sg-*` styling,
  portalling/positioning for popovers, scroll-into-view, and DOM measurement.

So `createNumberInput` clamps/formats/steps and exposes `inputProps()`, while
`<SvNumberInput>` adds the box, spinner buttons and theme; `createCombobox`
runs the filter + open/active state, while `<SvComboBox>` adds the portalled
panel. You can always drop to the core when you need a bespoke look.

## Available cores

Selection: `createListbox`, `createCombobox`, `createDropdownList`,
`createAutocomplete`, `createTagsInput`, `createCountryInput`, `createButtonGroup`.
Inputs: `createNumberInput`, `createMaskedInput`, `createPhoneInput`,
`createColorInput`, `createPasswordInput`.
Buttons/toggles: `createToggle`, `createSwitch`, `createCheckbox`,
`createRadioGroup`, `createRating`.
Date/time: `createCalendar`, `createTimePicker`, `createDateTimePicker`.
Layout/range: `createTabs`, `createTree`, `createSlider`, `createGauge`,
`createAccordion`, `createSplitter`, `createFileUpload`.

Pure helpers are exported too - `filterOptions`, `groupOptions`,
`nextTypeaheadIndex`, `virtualRange`/`scrollToIndex` (windowing),
`moveTreeNode`/`sortTreeNodes`, `rules`/`runRules` (validation),
`phoneDigitsValid` - so you can build entirely custom controls on the same
foundation.

## Shared editor contract

The styled editors also share a small props contract (`SvEditorProps`):
`disabled`, `readonly`, `required`, `invalid`, `error`, `label`, `hint`, `size`,
`dir`, `name`, `id`, `ariaLabel`. The `editorAria(...)` helper turns that state
into the right `aria-invalid` / `aria-required` / `aria-describedby` attributes,
and `<SvField>` renders the label + hint + error chrome - both exported if you
want them on your own markup.
