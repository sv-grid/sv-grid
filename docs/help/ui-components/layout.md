# Layout & composite

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add layout"></div>

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvTabs

A WAI-ARIA tabs widget with roving tabindex and arrow-key navigation. The active
panel is rendered through the `panel` snippet (receives the active id).

```svelte
<SvTabs tabs={[{id:'a',label:'Overview'},{id:'b',label:'Activity'}]}
  value={tab} onChange={(id) => (tab = id)} variant="line">
  {#snippet panel(active)}
    {#if active === 'a'}…{:else}…{/if}
  {/snippet}
</SvTabs>
```

Props: `tabs` ({ id, label, disabled? }), `value`, `onChange(id)`, `orientation`
(`horizontal` | `vertical`), `variant` (`line` | `pill`), `activation`
(`automatic` | `manual`), `panel` snippet. Keyboard: arrows (skip disabled),
Home/End.

## SvTree

A WAI-ARIA tree view: expand/collapse, single-select highlight, and optional
cascading tri-state checkboxes. The visible tree is flattened internally so
keyboard nav stays simple.

```svelte
<SvTree nodes={tree} selected={sel} expandedIds={['root']}
  onSelect={(id) => (sel = id)} />

<!-- with checkboxes -->
<SvTree nodes={tree} checkable checked={checked} onCheck={(ids) => (checked = ids)} />
```

Node shape: `{ id, label, children?, disabled? }` (exported as `SvTreeNode`).
Props: `nodes`, `selected`, `onSelect(id)`, `expandedIds`, `onToggle(id, open)`,
`checkable`, `checked` (string[]), `onCheck(ids)`. Keyboard: up/down move,
right expands / into children, left collapses / to parent, Enter selects,
Space checks.

## SvForm

A schema-driven form that renders the UI-kit controls with labels, required +
custom validation, and a submit handler. Emits `onSubmit(values)` only when valid.

```svelte
<script>
  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', type: 'email',
      validate: (v) => (v && !v.includes('@') ? 'Invalid email' : null) },
    { name: 'plan', label: 'Plan', type: 'select',
      options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { name: 'starts', label: 'Start', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true },
  ]
</script>

<SvForm {fields} columns={2} initial={{ plan: 'pro' }}
  onSubmit={(values) => save(values)} submitLabel="Create" />
```

Field types: `text` `email` `tel` `textarea` `number` `password` `select`
`checkbox` `switch` `date` `color` `rating`. Field shape:
`{ name, label, type?, required?, placeholder?, options?, validate?, full? }`.
Props: `fields`, `initial`, `onSubmit(values)`, `onChange(values)`, `columns`,
`submitLabel`, `disabled`.

## SvDivider

A separator line, horizontal or vertical, optionally with a label.

```svelte
<SvDivider label="OR" />
<SvDivider orientation="vertical" />
```

Props: `orientation`, `label`, `align` (`start` | `center` | `end`), `dashed`, `children`.

## SvScrollArea

A scroll container with the kit's themed custom scrollbars (consumes the
`--sg-scrollbar-*` tokens with `--sg-fg`-derived fallbacks) - so a panel matches
the grid/demos without hand-rolling `::-webkit-scrollbar` CSS.

```svelte
<SvScrollArea maxHeight="240px">…long content…</SvScrollArea>
```

Props: `maxHeight`, `height`, `horizontal`, `children`.

## SvCarousel

A slideshow: a sliding track with arrows, dot indicators, autoplay (pauses on
hover/focus) and swipe. Slides come from the `slide` snippet.

```svelte
<SvCarousel count={imgs.length} autoplay={4000}>
  {#snippet slide(i)}<img src={imgs[i]} alt="" />{/snippet}
</SvCarousel>
```

Props: `count`, `slide` snippet, `current` (bindable), `autoplay` (ms; 0 = off),
`loop`, `arrows`, `dots`.

## SvDockLayout

A tiled docking layout: nested resizable split groups and tabbed leaves with
drag-to-dock. The whole layout is a plain, serializable `DockNode` tree you
`bind`, and every gesture is a pure, immutable transform - so a workspace saves
to JSON and restores exactly. The building block for IDE-style workspaces, BI
dashboards, and trading desks.

```svelte
<div style="height: 480px">
  <SvDockLayout bind:layout>
    {#snippet pane(p)}<div>{p.title}</div>{/snippet}
  </SvDockLayout>
</div>
```

Build the tree with `dockGroup` / `dockTabs` / `dockPane`. Props: `layout`
(bindable `DockNode`), `pane` snippet, `onLayoutChange`, `minSize`. Full guide:
[SvDockLayout](./sv-dock-layout.md).

## SvDockManager

The full docking manager on top of SvDockLayout: adds floating / pop-out
windows, tab reordering, and pinning / auto-hide edges. The whole workspace -
tiled `main`, `floating` windows, and `autoHide` edges - is one serializable
`DockManagerState` you `bind`, with an imperative API via `onReady`.

```svelte
<div style="height: 520px">
  <SvDockManager bind:workspace onReady={(a) => (api = a)}>
    {#snippet pane(p)}<div>{p.title}</div>{/snippet}
  </SvDockManager>
</div>
```

Props: `workspace` (bindable `DockManagerState`), `pane` snippet, `onChange`,
`onEvent`, `onReady`, `reorderEnabled`, `headerPosition`, `keepAlive`. Full
guide: [SvDockManager](./sv-dock-manager.md).

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvTabs](./sv-tabs.md) - a WAI-ARIA tabs widget with panels.
- [SvAccordion](./sv-accordion.md) - collapsible sections, single or multi-expand.
- [SvSplitter](./sv-splitter.md) - two resizable panes with a draggable gutter.
- [SvDockLayout](./sv-dock-layout.md) - tiled drag-to-dock splits and tabs.
- [SvDockManager](./sv-dock-manager.md) - docking with floating windows, reorder and auto-hide.
- [SvCard](./sv-card.md) - a themed surface with header, body and footer.
- [SvDivider](./sv-divider.md) - a separator line with an optional label.
- [SvScrollArea](./sv-scroll-area.md) - a scroll container with themed scrollbars.
- [SvGridChart](./sv-grid-chart.md) - an inline-SVG chart bound to your data.
- [SvForm](./sv-form.md) - a schema-driven form of kit controls.
- [SvField](./sv-field.md) - the shared label/hint/error chrome for editors.
- [SvFileUpload](./sv-file-upload.md) - a drag-and-drop file field with validation.
