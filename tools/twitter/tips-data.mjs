// Single source of truth for the tips program.
//
// Each tip feeds THREE things from one definition:
//   1. a section on an indexable, SEO-targeted blog page (build-tips-pages.mjs)
//   2. a tweet in the daily rotation (compose.mjs / select-content.mjs)
//   3. the deep-link the tweet points back to (blog page + #anchor)
//
// This is the compounding loop: write a tip once -> it becomes rankable content
// AND a tweet that drives traffic to that content.
//
// Fields per tip:
//   anchor   - stable kebab-case id; the page heading anchor + tweet deep-link
//   title    - the tip, as a page heading and card headline (keep it tight)
//   tweet    - the standalone tweet line (must make sense with no code/link)
//   body     - 1-2 sentences of explanation for the page (and card subline)
//   code     - a short, correct snippet (shown on the card + as a page code block)
//   hashtags - 1-2, no '#'
//   link     - (SvGrid tips only) the canonical docs page for that feature
//
// Rules: correct code only (wrong Svelte advice would burn credibility), no
// em-dashes, no rival-grid vendor names.

export const SVELTE_TIPS_SLUG = 'svelte-5-tips-and-tricks'
export const SVGRID_TIPS_SLUG = 'svgrid-tips-and-tricks'
export const SVGRID_UI_TIPS_SLUG = 'svgrid-ui-components-tips-and-tricks'
export const SVGRID_STUDIO_TIPS_SLUG = 'svgrid-studio-tips-and-tricks'

// General Svelte 5 tips - the audience play. These target real search demand
// ("svelte $state", "svelte snippets", "svelte $derived") and pull Svelte devs
// into the funnel. No product link in the tip itself; the tweet reply points to
// the on-site page so the traffic lands on rankable content.
export const SVELTE_TIPS = [
  {
    anchor: 'state',
    title: '$state makes any variable reactive',
    tweet: 'In Svelte 5, reactivity is a rune. Wrap a value in $state and every read of it updates when it changes - no stores, no boilerplate.',
    body: '$state replaces the old top-level `let` reactivity. It works in components and, crucially, in plain `.svelte.js` / `.svelte.ts` modules too, so shared reactive state no longer needs a store.',
    code: `let count = $state(0)\ncount++ // every reader re-runs`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'derived',
    title: '$derived instead of reactive $:',
    tweet: 'Computed values in Svelte 5 use $derived. It is lazy, cached, and only recomputes when a dependency actually changes.',
    body: '`$derived(expr)` replaces `$: value = expr`. For multi-statement logic use `$derived.by(() => { ... })` and return the result.',
    code: `let doubled = $derived(count * 2)\nlet total = $derived.by(() => {\n  return items.reduce((s, i) => s + i.qty, 0)\n})`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'props',
    title: '$props() with defaults and rest',
    tweet: 'Destructure component props with $props() - defaults, renaming, and a rest object all in one line.',
    body: 'One rune replaces `export let`. Defaults, aliasing reserved words, and gathering the rest for spreading onto an element all work with plain destructuring.',
    code: `let { size = 'md', class: cls, ...rest } = $props()`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'bindable',
    title: '$bindable() for two-way props',
    tweet: 'Want a prop a parent can bind:? Mark it $bindable(). Explicit two-way binding, opt-in per prop.',
    body: 'Binding is no longer implicit. A child declares which props are bindable, so the two-way contract is visible in the code.',
    code: `let { value = $bindable('') } = $props()\n// parent: <Field bind:value={name} />`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'effect-cleanup',
    title: '$effect can return its own cleanup',
    tweet: 'Return a function from $effect and Svelte runs it before the next effect and on unmount. Timers and listeners clean themselves up.',
    body: '$effect tracks whatever it reads and re-runs when those change. The returned teardown makes subscriptions leak-free without a separate onDestroy.',
    code: `$effect(() => {\n  const id = setInterval(tick, 1000)\n  return () => clearInterval(id)\n})`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'state-raw',
    title: '$state.raw for large, replace-only data',
    tweet: 'Not everything needs deep reactivity. $state.raw skips the proxy - reassign the whole value to update. Great for big arrays and API payloads.',
    body: 'Deep proxying every row of a 10k-item array is wasteful if you only ever replace the array. `$state.raw` gives shallow reactivity: mutations are not tracked, reassignment is.',
    code: `let rows = $state.raw([])\nrows = await fetchRows() // triggers; rows.push() would not`,
    hashtags: ['Svelte', 'Performance'],
  },
  {
    anchor: 'snippets',
    title: 'Snippets replace slots',
    tweet: 'Slots are gone in Svelte 5. Define reusable markup with {#snippet} and drop it in with {@render} - and pass snippets as props.',
    body: 'Snippets are first-class values: name them, parameterize them, pass them to child components as props. One primitive covers default slots, named slots, and slot props.',
    code: `{#snippet row(item)}\n  <td>{item.name}</td>\n{/snippet}\n{@render row(user)}`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'events',
    title: 'Event handlers are just attributes now',
    tweet: 'on:click is out; onclick is in. Event handlers in Svelte 5 are plain attributes, so they spread and forward like any other prop.',
    body: 'Because handlers are attributes, `{...props}` forwards them automatically and there is no separate event-forwarding syntax to remember.',
    code: `<button onclick={() => count++}>+1</button>`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'inspect',
    title: '$inspect is console.log for runes',
    tweet: 'Debugging reactive state? $inspect logs a value every time it changes, with a nice before/after - and it is stripped from production builds.',
    body: 'Add `$inspect(x)` to trace re-renders, or `$inspect(x).with(fn)` for custom handling. It only runs in dev, so you can leave it while iterating.',
    code: `$inspect(count, filters)`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'shared-state',
    title: 'Put shared state in a .svelte.js module',
    tweet: 'Runes work outside components. Export $state from a .svelte.js/.ts file and you have shared, reactive app state with zero store boilerplate.',
    body: 'Rename the file with a `.svelte.js` / `.svelte.ts` extension so the compiler processes the runes, then import the state anywhere. This is the modern replacement for writable stores in most cases.',
    code: `// counter.svelte.js\nexport const counter = $state({ n: 0 })`,
    hashtags: ['Svelte', 'SvelteKit'],
  },
  {
    anchor: 'state-snapshot',
    title: '$state.snapshot for a plain copy',
    tweet: 'Need to send reactive state to something that hates proxies - JSON, structuredClone, an external lib? $state.snapshot gives you a plain, deep, non-reactive copy.',
    body: 'A `$state` value is a Proxy. Some APIs choke on that. `$state.snapshot(x)` returns a static clone with the proxies stripped, safe to serialize or hand off.',
    code: `const payload = $state.snapshot(form)\nawait fetch('/api/save', { method: 'POST', body: JSON.stringify(payload) })`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'untrack',
    title: 'untrack() reads without subscribing',
    tweet: 'Inside an $effect you sometimes want to READ a value without re-running when it changes. Wrap that read in untrack() and the effect ignores it as a dependency.',
    body: 'Handy when an effect should fire on one signal but only sample another. Everything read outside `untrack` is still tracked as normal.',
    code: `import { untrack } from 'svelte'\n$effect(() => { save(doc); const at = untrack(() => savedAt) })`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'effect-pre',
    title: '$effect.pre runs before the DOM updates',
    tweet: 'Regular $effect runs after the DOM paints. Need to act on the OLD layout first - like keeping a chat pinned to the bottom? $effect.pre runs before the update.',
    body: 'Read scroll position or measurements in `$effect.pre`, decide what to do, then let the DOM update. The classic auto-scroll-on-new-message pattern.',
    code: `$effect.pre(() => {\n  messages.length // track new messages\n  if (atBottom) tick().then(scrollToBottom)\n})`,
    hashtags: ['Svelte', 'Svelte5'],
  },
  {
    anchor: 'reactive-class',
    title: 'Runes work as class fields',
    tweet: 'Put $state and $derived straight on class fields and you get a reactive model object - methods included - that any component can use. OOP state without a store.',
    body: 'Class instances become reactive view-models: `$state` fields are tracked, `$derived` fields recompute, and methods mutate them. Great for carts, editors, wizards.',
    code: `class Cart {\n  items = $state([])\n  total = $derived(this.items.reduce((s, i) => s + i.price, 0))\n  add(p) { this.items.push(p) }\n}`,
    hashtags: ['Svelte', 'Svelte5'],
  },
]

// SvGrid tips - long-tail how-to content that ranks for "svelte data grid ..."
// and shows off the product. Each links to its canonical docs page.
export const SVGRID_TIPS = [
  {
    anchor: 'fit-columns',
    title: 'Fill the viewport with fitColumns',
    tweet: 'Stop hand-tuning column widths. One prop scales them to fill the grid, absorbing the rounding residue in the last column.',
    body: 'fitColumns sizes columns to the available width and only falls back to a horizontal scrollbar when it would shrink columns below ~85% of their natural width.',
    code: `<SvGrid {data} {columns} fitColumns />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/columns/overview',
  },
  {
    anchor: 'cell-flash',
    title: 'Flash a cell when its value changes',
    tweet: 'Live data? Set cellFlash on a column and SvGrid flashes the cell on every value change - keyed by row identity, so virtual scrolling never false-flashes.',
    body: 'Perfect for streaming feeds and server pushes. It respects prefers-reduced-motion out of the box.',
    code: `columns: [{ field: 'price', cellFlash: true }]`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/cells/overview',
  },
  {
    anchor: 'on-cell-value-change',
    title: 'Persist edits with onCellValueChange',
    tweet: 'The one hook you need for server-side saves: onCellValueChange fires after every inline edit with the row, column, old and new value.',
    body: 'Use it to POST the change, trigger a cascading recompute, or optimistic-update your store. It fires only after the edit commits.',
    code: `<SvGrid onCellValueChange={(e) => save(e.row)} />`,
    hashtags: ['Svelte', 'SvelteKit'],
    link: 'https://svgrid.com/docs/help/editing/saving-values',
  },
  {
    anchor: 'board-mode',
    title: 'Turn the grid into a Kanban board',
    tweet: 'Same data, two views. Add the board prop and SvGrid renders a drag-and-drop Kanban with swimlanes and WIP limits - toggle back to the table anytime.',
    body: 'Board mode is a rendering of the same rows, so filters, sorting, and search carry straight over. Drag works with mouse and keyboard.',
    code: `<SvGrid {data} {columns} board={{ groupBy: 'status' }} />`,
    hashtags: ['Svelte', 'Kanban'],
    link: 'https://svgrid.com/docs/help/rows/kanban-board',
  },
  {
    anchor: 'external-pipeline',
    title: 'Own the data pipeline with externalSort/Filter',
    tweet: 'Doing server-side sorting and filtering? externalSort + externalFilter let SvGrid track the UI state while you run the query. It never re-orders rows behind your back.',
    body: 'Pair them with onSortingChange / onFiltersChange to get the consolidated state, fetch, and hand back the new rows. The backbone of server-side data.',
    code: `<SvGrid externalSort externalFilter\n  onSortingChange={load} onFiltersChange={load} />`,
    hashtags: ['Svelte', 'SvelteKit'],
    link: 'https://svgrid.com/docs/help/server-side-data',
  },
  {
    anchor: 'theming-tokens',
    title: 'Theme the grid with --sg-* tokens',
    tweet: 'Every color in SvGrid is a CSS variable. Override a handful of --sg-* tokens for a full re-skin, and flip dark mode with data-theme.',
    body: 'No theme API to learn: the grid ships complete chrome driven by tokens, and your overrides always win. 20+ ready-made themes ship in the box.',
    code: `:root { --sg-accent: #ff3e00; }\n[data-theme='dark'] { --sg-bg: #0e1730; }`,
    hashtags: ['Svelte', 'CSS'],
    link: 'https://svgrid.com/docs/getting-started/5-theme-and-density',
  },
  {
    anchor: 'headless',
    title: 'Render your own cells, keep the engine',
    tweet: 'Need total control of the markup? Drive the headless SvGrid controller and render every cell yourself - virtualization, sorting and filtering still handled for you.',
    body: 'The full component is a render layer over a headless core. Drop down to the core when a design system needs to own the DOM.',
    code: `const grid = createSvGrid({ data, columns })\n// render grid.rows yourself`,
    hashtags: ['Svelte', 'Headless'],
    link: 'https://svgrid.com/docs/help/headless/overview',
  },
  {
    anchor: 'row-numbers',
    title: 'Add a row-number column with one prop',
    tweet: 'showRowNumbers gives you a clean 1-based index column, rendered before any selection checkbox. No extra column def needed.',
    body: 'Handy for spreadsheets and audit views where users refer to rows by position.',
    code: `<SvGrid {data} {columns} showRowNumbers />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/rows/overview',
  },
  {
    anchor: 'charts',
    title: 'Chart a selection without a chart library',
    tweet: 'Select a range of cells in SvGrid, right-click, and get a live chart - bars, lines, pies - that you can export as an image. No extra dependency.',
    body: 'SvGridChart reads the current selection and renders directly, so exploratory charts are one interaction away.',
    code: `import { SvGridChart } from '@svgrid/grid'`,
    hashtags: ['Svelte', 'DataViz'],
    link: 'https://svgrid.com/docs/help/charts',
  },
  {
    anchor: 'responsive',
    title: 'Make the grid phone-friendly with responsive',
    tweet: 'One prop adapts the grid for small screens: it auto-unpins columns, suspends fit-to-width, and switches to touch scrolling below your breakpoint.',
    body: 'Combine it with per-column hideBelow to drop low-priority columns on narrow viewports instead of cramming everything in.',
    code: `<SvGrid responsive columns={[{ field: 'notes', hideBelow: 640 }]} />`,
    hashtags: ['Svelte', 'Responsive'],
    link: 'https://svgrid.com/docs/help/columns/overview',
  },
  {
    anchor: 'boolean-shortcuts',
    title: 'Turn on features with one boolean each',
    tweet: 'A bare SvGrid is a plain read-only table - every capability is opt-in. sortable, filterable, editable, pageable: one boolean each turns the whole feature on.',
    body: 'The shortcut props wire the underlying feature for you, so you can start minimal and switch on exactly what a grid needs, one word at a time.',
    code: `<SvGrid {data} {columns} sortable filterable editable pageable />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/getting-started',
  },
  {
    anchor: 'filter-row',
    title: 'Pick your filter surface with filterMode',
    tweet: 'SvGrid has three filter UIs: a per-column menu, a filter row under the header, and a single global search box. filterMode picks which one appears.',
    body: 'Set `filterMode="row"` for a spreadsheet-style filter row, `"global"` for one search box, or `"menu"` (default) for the in-header filter section.',
    code: `<SvGrid {data} {columns} filterable filterMode="row" />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/filtering',
  },
  {
    anchor: 'grouping',
    title: 'Group rows and roll up totals',
    tweet: 'Turn on groupable and users can group by any column from the UI, with collapsible group rows and aggregated totals rolled up per group. No pivot table needed for the basics.',
    body: 'Row grouping plus aggregation gives you subtotals and counts per group out of the box, and users can regroup at runtime by dragging columns.',
    code: `<SvGrid {data} {columns} groupable />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/grouping-aggregation',
  },
  {
    anchor: 'server-pagination',
    title: 'Server-side paging without fighting the grid',
    tweet: 'For millions of rows, let the server page. externalPagination makes SvGrid render its footer from the rowCount you provide and emit onPaginationChange - you fetch just that page.',
    body: 'The grid stops slicing local data and treats what you pass as the current page. Pair it with externalSort/externalFilter for a fully server-driven grid.',
    code: `<SvGrid {data} externalPagination {rowCount} {pageIndex}\n  onPaginationChange={load} showPagination />`,
    hashtags: ['Svelte', 'SvelteKit'],
    link: 'https://svgrid.com/docs/help/server-side-data',
  },
  {
    anchor: 'export-csv',
    title: 'Export the grid from the API',
    tweet: 'Grab the grid API and call exportCsv() - or exportTsv() / exportJson() - to download exactly what the user sees, respecting current sort, filters and column order.',
    body: 'Exports honor the live view, not just the raw data. For an in-grid button with format options, drop in the SvExportMenu component from the enterprise package.',
    code: `api.exportCsv({ fileName: 'orders.csv' }) // exportTsv(), exportJson() too`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/export',
  },
  {
    anchor: 'pinned-rows',
    title: 'Pin totals rows to the bottom',
    tweet: 'Keep a running total or a header row always in view: pinnedTopRows and pinnedBottomRows stay stuck while the data scrolls between them.',
    body: 'Great for summary/total rows that must never scroll away. They keep their own styling and sit outside the virtualized data area.',
    code: `<SvGrid {data} {columns} pinnedBottomRows={[totalsRow]} />`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/rows/overview',
  },
  {
    anchor: 'scheduler-mode',
    title: 'Render the same rows as a calendar',
    tweet: 'Rows with a start date? Add the scheduler prop and SvGrid renders them as events on a Month/Week/Day/Agenda calendar - drag to move, drag an edge to resize.',
    body: 'Like board mode, the scheduler is another view of the same data: map a start (and optional end/title) field and the grid does the calendar layout.',
    code: `<SvGrid {data} scheduler={{ startField: 'start', titleField: 'title' }} />`,
    hashtags: ['Svelte', 'Scheduler'],
    link: 'https://svgrid.com/docs/help/scheduling',
  },
  {
    anchor: 'pivot-mode',
    title: 'Pivot with a drag-and-drop designer',
    tweet: 'SvPivotDesigner turns the grid into a pivot table: drag fields into rows, columns and values and get cross-tab aggregates, with a docked config panel and a pivot-mode toggle.',
    body: 'It ships in the enterprise package and drives the same grid, so your themes and formatting carry over into the pivot view.',
    code: `import { SvPivotDesigner } from '@svgrid/enterprise'`,
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/pivot',
  },
]

// SvGrid UI Components tips - the standalone Svelte 5 component kit that ships
// alongside the grid (buttons, inputs, overlays, tree, forms, command palette,
// date/time). Each tip references a real exported component and its actual props.
export const SVGRID_UI_TIPS = [
  {
    anchor: 'ui-button',
    title: 'SvButton has states baked in',
    tweet: 'SvButton is not just a styled button: variant, size, a loading spinner and a leading icon snippet are all props. One component covers primary, danger, ghost and link buttons.',
    body: 'Set `loading` and the button shows a spinner and goes disabled, so async actions cannot double-fire. `href` renders an anchor that still looks like a button.',
    code: `<SvButton variant="danger" {loading} onclick={remove}>Delete</SvButton>`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-button',
  },
  {
    anchor: 'ui-command',
    title: 'Add a Cmd+K palette in one component',
    tweet: 'SvCommand gives you a full command palette - fuzzy search, keyboard nav, and a built-in Cmd/Ctrl+K hotkey. Pass a list of commands and an onRun handler, done.',
    body: 'The hotkey is configurable (`mod+k`, `mod+p`, or off) and the open state is bindable, so you can also trigger it from a button.',
    code: `<SvCommand bind:open {commands} hotkey="mod+k" onRun={run} />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-command',
  },
  {
    anchor: 'ui-tree',
    title: 'SvTree scales to big hierarchies',
    tweet: 'SvTree does cascading checkboxes, a built-in search box, lazy children on expand, and row virtualization - so a tree of thousands of nodes stays smooth.',
    body: 'Turn on `virtual` with a `height` to window the rows, `searchable` for the filter box, and `loadChildren` to fetch a lazy branch the first time it opens.',
    code: `<SvTree {nodes} checkable searchable virtual height={480} />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-tree',
  },
  {
    anchor: 'ui-form',
    title: 'Generate a form from a fields schema',
    tweet: 'SvForm builds a labelled, validated form from a plain fields array - multi-column layout, initial values and an onSubmit that hands you the typed values. No markup per field.',
    body: 'Describe each field once (type, label, validation) and SvForm renders the inputs, wires validation, and lays them out across `columns`.',
    code: `<SvForm {fields} initial={row} columns={2} onSubmit={save} />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-form',
  },
  {
    anchor: 'ui-datetime',
    title: 'A date/time field that actually parses',
    tweet: 'SvDateTimePicker is a masked field plus a calendar: type or pick, with min/max bounds, 12 or 24-hour time, week numbers and locale-aware formatting via a format string.',
    body: 'It commits on Enter/blur and cancels on Escape, so it drops straight into a grid cell or a form. `formatString` controls both display and parsing.',
    code: `<SvDateTimePicker bind:value min={today} hourFormat="24-hour" />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-date-time-picker',
  },
  {
    anchor: 'ui-editor-contract',
    title: 'Every input shares one field contract',
    tweet: 'label, hint, error, required and RTL work the same on every SvGrid input - text, number, multi-select, date. Learn the contract once and it holds across the whole kit.',
    body: 'Inputs share a common editor-props layer, so a11y wiring, validation display and right-to-left mirroring are consistent instead of per-component guesswork.',
    code: `<SvMultiSelect {options} bind:value label="Tags" required hint="Pick a few" />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/inputs',
  },
  {
    anchor: 'ui-tabs',
    title: 'SvTabs does closable, positionable tabs',
    tweet: 'SvTabs is more than a strip of buttons: bindable value, vertical or horizontal orientation, tab position on any side, and optional close buttons for an editor-style UI.',
    body: 'Drive it from a `tabs` array and `bind:value`. `onClose` gives you closable tabs, and `orientation`/`tabPosition` cover side rails and bottom bars.',
    code: `<SvTabs {tabs} bind:value onClose={close} tabPosition="left" />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-tabs',
  },
  {
    anchor: 'ui-stepper',
    title: 'Build a wizard with SvStepper',
    tweet: 'SvStepper renders a multi-step progress header and, in linear mode, stops users skipping ahead. Bind current and you have a wizard in a few lines.',
    body: 'Pass the `steps`, `bind:current`, and set `linear` to enforce order. Horizontal or vertical, it is the backbone of any onboarding or checkout flow.',
    code: `<SvStepper {steps} bind:current linear />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-stepper',
  },
  {
    anchor: 'ui-drawer',
    title: 'SvDrawer for slide-in panels',
    tweet: 'SvDrawer gives you an accessible slide-in panel from any side, with backdrop, Escape-to-close and focus handling built in. Perfect for detail views and filters.',
    body: 'Bind `open`, pick a `side` and `size`, and it handles the overlay, scroll lock and dismissal. It is also what the grid uses for its card detail drawer.',
    code: `<SvDrawer bind:open side="right" title="Details">{content}</SvDrawer>`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-drawer',
  },
  {
    anchor: 'ui-number',
    title: 'SvNumberInput knows about numbers',
    tweet: 'SvNumberInput does the numeric stuff text inputs botch: min/max clamping, step buttons, decimal precision, thousands grouping, and a currency/unit prefix or suffix.',
    body: 'Set `precision` and `grouping` and it formats as the user types; `min`/`max`/`step` keep the value valid. No regex-in-an-input gymnastics.',
    code: `<SvNumberInput bind:value min={0} step={0.5} precision={2} prefix="$" grouping />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-number-input',
  },
  {
    anchor: 'ui-tree-select',
    title: 'Pick from a hierarchy with SvTreeSelect',
    tweet: 'SvTreeSelect is a dropdown backed by a tree - pick a category, folder or org node from nested options, and show the full path so the choice is unambiguous.',
    body: 'Feed it the same `nodes` shape as SvTree, `bind:value`, and turn on `showPath` to render breadcrumbs for the selected node.',
    code: `<SvTreeSelect {nodes} bind:value showPath />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-tree-select',
  },
  {
    anchor: 'ui-grid-select',
    title: 'SvGridSelect is a dropdown with columns',
    tweet: 'When a plain option list is not enough, SvGridSelect drops a mini data grid into the dropdown - multiple columns, so users pick a record by more than one field.',
    body: 'Define `columns` and `options`, point `labelField`/`idField` at the record, and users choose from a tabular list instead of a flat one.',
    code: `<SvGridSelect {columns} {options} idField="id" labelField="name" bind:value />`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-grid-select',
  },
  {
    anchor: 'ui-tooltip',
    title: 'SvTooltip wraps any element',
    tweet: 'SvTooltip adds an accessible, placement-aware tooltip to whatever you wrap - configurable delay and side, and it stays out of the way on touch. No global setup.',
    body: 'Wrap the trigger, set `text` and a `placement`, and it handles positioning, timing and ARIA wiring for you.',
    code: `<SvTooltip text="Archive" placement="top"><button>Archive</button></SvTooltip>`,
    hashtags: ['Svelte', 'UI'],
    link: 'https://svgrid.com/docs/help/ui-components/sv-tooltip',
  },
]

// SvGrid Studio tips - the data-app layer: design entities and screens, then
// generate a real SvelteKit app. These are capability tips (Studio is a
// designer, so snippets are config/CLI-shaped rather than component markup).
export const SVGRID_STUDIO_TIPS = [
  {
    anchor: 'studio-ai',
    title: 'Describe an app, get real screens',
    tweet: 'SvGrid Studio has an AI generator (and its own MCP server): describe the app you want and it scaffolds the entities, grids and screens - then you refine them in the designer.',
    body: 'The generator writes the same project a human would build by hand, so nothing is a black box: everything it makes is editable and emits real code.',
    code: `npx @svgrid/studio generate "a CRM with contacts, deals and tasks"`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/ai-generation',
  },
  {
    anchor: 'studio-designer',
    title: 'The designer emits a real SvelteKit app',
    tweet: 'Studio is not a runtime you are locked into. Design entities and screens visually and it generates a real SvelteKit project - routes, +page.svelte, API handlers - that you own.',
    body: 'Drag screens together in the app designer; the output is plain, readable SvelteKit code you can keep building on outside Studio.',
    code: `npx @svgrid/studio build ./my-app.studio.json`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/app-designer',
  },
  {
    anchor: 'studio-forms',
    title: 'Edit forms come from your schema',
    tweet: 'Mark a screen as a form screen and Studio derives a full edit form from the entity schema - inputs, validation and computed fields included. Change the schema, the form follows.',
    body: 'Field types, required rules and computed values live on the entity, so the create/edit form stays in sync instead of being hand-maintained.',
    code: `screen: { type: 'form', entity: 'contact' }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/edit-forms',
  },
  {
    anchor: 'studio-code-behind',
    title: 'Add code-behind with ctx.grid',
    tweet: 'Screens are not sealed. Studio wires code-behind into every entity screen and exposes ctx.grid, so your custom logic can drive the grid the designer generated.',
    body: 'Drop into a handler and you get the live grid API plus the screen context - the escape hatch for anything the visual designer does not cover.',
    code: `onRowClick(row, ctx) { ctx.grid.selectRow(row.id) }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/business-logic',
  },
  {
    anchor: 'studio-production',
    title: 'Studio apps ship to production',
    tweet: 'Studio is not just a prototype tool: toggle on an auth/session starter, a typed Drizzle data layer (pg/sqlite/turso) and a CI/CD deploy pipeline. The generated app is production-shaped.',
    body: 'These are real, standard building blocks emitted into the project - auth, a typed database layer and deploy config - not a proprietary hosting lock-in.',
    code: `project.auth = true\nproject.dataLayer = 'drizzle'\nproject.deploy = 'docker'`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/auth',
  },
  {
    anchor: 'studio-data-binding',
    title: 'Bind screens to real data sources',
    tweet: 'Studio screens bind to in-memory data, a REST endpoint or SQL - and you can flip a sample from in-memory to a local Postgres with one toggle, no rewrite.',
    body: 'Design against seeded in-memory data, then point the same screens at a live database when you are ready. The binding, not the UI, is what changes.',
    code: `entity.source = { kind: 'sql', table: 'contacts' }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/data-binding',
  },
  {
    anchor: 'studio-actions',
    title: 'Add buttons that run real handlers',
    tweet: 'Studio screens are not read-only. Drop a custom action button on a screen and it generates the button plus a typed API handler stub - the round-trip, not just the UI.',
    body: 'Actions emit a real `/api/actions/<id>` route and a handler you fill in, so a button like Approve or Send is wired end to end, not faked.',
    code: `screen.actions = [{ id: 'approve', label: 'Approve', handler: 'approveOrder' }]`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/business-logic',
  },
  {
    anchor: 'studio-toolbox',
    title: 'Drag UI components onto any page',
    tweet: 'Studio has a UI toolbox: drag SvButton, Badge, Alert and friends onto a screen - even a freestanding page - and configure their props in the designer. Layouts, not just grids.',
    body: 'Screens are composable. The toolbox is registry-driven, so building a landing or dashboard page is drag, drop and set props - and it all emits real Svelte.',
    code: `// drag SvButton onto a page, then bind its onclick to an action`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/app-designer',
  },
  {
    anchor: 'studio-rbac',
    title: 'Gate data and screens with roles',
    tweet: 'Studio bakes in access control: declare which roles can read or write an entity, and screens and API routes enforce it. RBAC is a config, not a rewrite.',
    body: 'Role rules live on the entity and flow through to the generated UI and server handlers, so a viewer cannot edit and a page can hide behind a role.',
    code: `entity.access = { read: ['*'], write: ['admin', 'manager'] }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/access-control',
  },
  {
    anchor: 'studio-dashboards',
    title: 'Compose dashboards from KPI cards',
    tweet: 'A Studio dashboard screen is a grid of cards - KPIs with formatting, sparklines and targets, plus charts - built over the same entities that back your tables.',
    body: 'Point a card at a field and an aggregate and Studio renders the metric; combine cards and charts for an at-a-glance screen without a separate BI tool.',
    code: `screen: { type: 'dashboard', cards: [{ metric: 'revenue', agg: 'sum', format: 'currency' }] }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/dashboards',
  },
  {
    anchor: 'studio-master-detail',
    title: 'Wire master-detail from a relation',
    tweet: 'Declare a relation between two entities and Studio can generate a master-detail screen - pick a parent row, see its children - with the join handled for you.',
    body: 'Relations are first-class: one definition drives the detail grid, the drill-through and the query, so parent/child screens are not hand-plumbed.',
    code: `relation: { parent: 'order', child: 'lineItem', on: 'orderId' }`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/master-detail',
  },
  {
    anchor: 'studio-deploy',
    title: 'Ship with a generated deploy pipeline',
    tweet: 'Studio can emit the CI/CD too: a GitHub Actions workflow, a Dockerfile and per-target deploy config, so the app you designed has a path to production from day one.',
    body: 'Pick a deploy target and Studio scaffolds the pipeline alongside the app, turning "it works in the designer" into "it is live" without bespoke DevOps.',
    code: `project.deploy = { target: 'docker' } // or 'vercel', 'node'`,
    hashtags: ['Svelte', 'Studio'],
    link: 'https://svgrid.com/docs/enterprise/studio/deployment',
  },
]

// The pool the daily TIP tweet rotates through: product tips across all three
// areas (grid, UI components, Studio). Grid first so the flagship leads. Each
// carries its `page` (the on-site tips page slug) so the tweet can deep-link to
// that tip's #anchor - rankable, on-site content that then routes on to the docs.
export const PRODUCT_TIPS = [
  ...SVGRID_TIPS.map((t) => ({ ...t, area: 'SvGrid', page: SVGRID_TIPS_SLUG })),
  ...SVGRID_UI_TIPS.map((t) => ({ ...t, area: 'SvGrid UI', page: SVGRID_UI_TIPS_SLUG })),
  ...SVGRID_STUDIO_TIPS.map((t) => ({ ...t, area: 'SvGrid Studio', page: SVGRID_STUDIO_TIPS_SLUG })),
]
