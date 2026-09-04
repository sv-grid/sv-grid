# Headless editors

Every editor is **headless-first**, exactly like the grid (`createSvGrid` /
`<SvGrid>`). Each `Sv*` component is a thin styled renderer over a framework-free
runes core named `create<Editor>`. Import the core to render your own markup with
the kit's state machine, keyboard handling and ARIA - and none of its styles.

## The pattern

A core is a factory that takes **reactive getters** for its inputs and returns
reactive state, actions, and **prop-getters** you spread onto your own elements.

```svelte {runnable}
<script lang="ts">
  import { createListbox, type ListboxValue } from '@svgrid/grid'

  // `ListboxValue` covers every selection shape the primitive can hand back:
  // a single value, an array, or a Set when `multiple` is on.
  let value = $state<ListboxValue>(null)
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
Navigation: `createPagination` (pager), `createStepper` (wizard steps),
`createCarousel` (slideshow with autoplay). `createPagination` and `createStepper`
are pure - no runes - so you can unit-test and even run them server-side.
Forms: `createForm` (schema-driven values/errors/touched + validation + submit).
Command palette: `createCommand` (fuzzy filter + roving + global hotkey) - pair it
with `createOverlay` for the focus-trap/scroll-lock/dismissal, as `SvCommand` does.
Overlays/menu: `createMenu` (the roving-focus + submenu state machine behind
`SvMenu` / `SvMenuList` / `SvContextMenu`), `createOverlay` (the dialog lifecycle
behind `SvModal` / `SvDrawer`), `createTooltip` (the hover/focus + show-delay +
Escape state machine behind `SvTooltip`).

**Toasts are already headless.** `SvToaster` is a thin renderer over the exported
`toastStore` + `toast()` / `dismissToast` / `pauseToast` / `resumeToast` /
`clearToasts` queue - the state machine (timers, pause-on-hover, live-region
announcement) lives in the store, so you can drive it from anywhere or render your
own toaster over the same store.

### Dialog overlays: `createOverlay`

`SvModal` and `SvDrawer` share one lifecycle core, `createOverlay`: when `open`
flips true it wires a focus trap, a body scroll-lock, and Escape/backdrop
dismissal (via the shared dismissable-layer stack, so nested overlays close
top-first), and tears them all down on close. Your component renders the backdrop
and panel and spreads `dialogProps()` for the ARIA:

```svelte
<script lang="ts">
  import { createOverlay } from '@svgrid/grid'
  let open = $state(false)
  let dialogEl = $state<HTMLElement | null>(null)
  const overlay = createOverlay({
    open: () => open,
    getDialog: () => dialogEl,
    onClose: () => (open = false),
  })
</script>

{#if open}
  <div class="backdrop">
    <div bind:this={dialogEl} {...overlay.dialogProps({ labelledBy: titleId })}>…</div>
  </div>
{/if}
```

### Anchored-panel selects: `createPopoverSelect`

The dropdown selects that render a panel to `<body>` - `SvMultiSelect`,
`SvTreeSelect`, `SvGridSelect` - share one engine, `createPopoverSelect`. It owns
open/close, the `anchoredRect` positioning (reposition on scroll/resize),
outside/Escape dismissal via the shared layer stack, a roving `active` index, and
the WAI-ARIA combobox wiring (`aria-expanded` / `aria-controls` /
`aria-activedescendant`). Your component owns the item rendering and passes in the
trigger/panel refs as getters:

```svelte
<script lang="ts">
  import { createPopoverSelect } from '@svgrid/grid'
  let trigger = $state<HTMLElement | null>(null)
  let panel = $state<HTMLElement | null>(null)

  const sel = createPopoverSelect({
    itemCount: () => options.length,
    onSelect: (i) => choose(options[i]),
    getTrigger: () => trigger,
    getPanel: () => panel,
  })
</script>

<button bind:this={trigger} {...sel.triggerProps('listbox')}>Choose</button>
{#if sel.open}
  <div bind:this={panel} {...sel.focusOwnerProps('listbox')}>
    {#each options as opt, i}
      <div {...sel.itemProps(i)} class:active={sel.isActive(i)}>{opt.label}</div>
    {/each}
  </div>
{/if}
```

## Data-model cores (dock)

A few composite components are headless in a second sense: instead of a
`create*` factory with prop-getters, they expose a **plain serializable state
tree plus pure, immutable transforms**. The state *is* the headless core - you
own it, `bind` it, persist it, and drive it from the exported functions; the
`Sv*` component is only the styled renderer.

- **`SvDockLayout`** - state is a `DockNode` tree (`dockGroup` / `dockTabs` /
  `dockPane`); transforms include `movePane`, `removePane`, `dockInto`,
  `dockSetActive`, `dockSetSizes`, `allPaneIds`.
- **`SvDockManager`** - state is a `DockManagerState` (`main` / `floating` /
  `autoHide`); transforms include `floatPane`, `dockPaneOnto`, `reorderTab`,
  `autoHideLeaf`, `pinAutoHidden`, `dockManagerClosePane`, `allManagerPaneIds`.

Every transform returns a new tree and is unit-tested independently of the DOM,
so you can compute or restore a whole workspace on the server or in a worker.
See [SvDockLayout](./sv-dock-layout.md) and [SvDockManager](./sv-dock-manager.md).

Pure helpers are exported too - `enabledIndices`/`wrapMove` (the roving-focus
navigation math shared by the listbox, menu and popover-select cores),
`filterOptions`, `groupOptions`, `nextTypeaheadIndex`,
`virtualRange`/`scrollToIndex` (windowing), `moveTreeNode`/`sortTreeNodes`,
`rules`/`runRules` (validation), `phoneDigitsValid` - so you can build entirely
custom controls on the same foundation.

## Shared editor contract

The styled editors also share a small props contract (`SvEditorProps`):
`disabled`, `readonly`, `required`, `invalid`, `error`, `label`, `hint`, `size`,
`dir`, `name`, `id`, `ariaLabel`. The `editorAria(...)` helper turns that state
into the right `aria-invalid` / `aria-required` / `aria-describedby` attributes,
and `<SvField>` renders the label + hint + error chrome - both exported if you
want them on your own markup.

## More examples

### Headless editors

Headless-first, like the grid: createListbox is the state machine behind SvListBox (roving focus, single/multi selection, keyboard, ARIA) exposed as prop-getters you spread onto YOUR own markup. One core drives both the styled SvListBox and a custom chip-cloud render, bound to one value.

<div data-docs-demo="260-headless-editors" data-height="420"></div>

## Building your own checkbox

A headless factory takes its reactive inputs as **getters**, not values -
that is how it tracks your state without owning it. It hands back the state to
read and a props bag to spread, and you write every element yourself.

```svelte {runnable}
<script lang="ts">
  import { createCheckbox } from '@svgrid/grid'

  let agreed = $state(false)

  // Getters, not values: passing the value would capture false forever.
  const box = createCheckbox({
    checked: () => agreed,
    onChange: (v) => (agreed = v),
  })
</script>

<button {...box.boxProps()} class="my-box" onclick={box.toggle}>
  {box.checked ? 'x' : ''}
</button>
<span>Terms accepted: {agreed}</span>

<style>
  .my-box {
    width: 20px; height: 20px;
    display: grid; place-items: center;
    border: 1px solid currentColor; border-radius: 4px;
    background: transparent; cursor: pointer; font: 12px/1 monospace;
  }
</style>
```
