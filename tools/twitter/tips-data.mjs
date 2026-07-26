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
]
