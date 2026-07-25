// Curated feature/demo highlights for the automated tweet rotation.
//
// Hand-written (not model-generated) so the brand voice stays controlled. Each
// entry maps to one tweet: a headline for the card, a short body, hashtags, and
// a link into the live docs or example. Keep copy on SvGrid's own terms - no
// rival-grid vendor names, no em-dashes (repo-wide rules).
//
// Ordering is stable; the selector rotates through the list by day so the same
// highlight does not repeat back-to-back. Add new entries at the end.

export const HIGHLIGHTS = [
  {
    id: 'kanban',
    eyebrow: 'Board mode',
    headline: 'Turn any grid into a Kanban board with one prop.',
    body: 'Drag-and-drop (mouse + keyboard), swimlanes, WIP limits, and a Board <-> Table toggle over the same data. The grid is still the hero.',
    hashtags: ['Svelte', 'Kanban'],
    link: 'https://svgrid.com/docs/help/rows/kanban-board',
    footerRight: 'Kanban board mode',
  },
  {
    id: 'virtualization',
    eyebrow: 'Performance',
    headline: 'A million rows. Still 60fps.',
    body: 'Row and column virtualization built in - scroll huge datasets smoothly with no config. Built for Svelte 5 runes.',
    hashtags: ['Svelte', 'WebPerf'],
    link: 'https://svgrid.com/docs/help/headless/virtualization',
    footerRight: 'Virtualized rendering',
  },
  {
    id: 'filters',
    eyebrow: 'Filtering',
    headline: 'Excel-style filters, out of the box.',
    body: 'Per-column set filters, text and number conditions, quick search, and faceted filtering - one prop pass, fully themeable.',
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/filtering/overview',
    footerRight: 'Excel-style filters',
  },
  {
    id: 'editing',
    eyebrow: 'Editing',
    headline: 'Inline editing with real validation.',
    body: 'A full editor kit - text, number, date, select, and more - with per-cell validation and computed columns. Edit like a spreadsheet.',
    hashtags: ['Svelte', 'Forms'],
    link: 'https://svgrid.com/docs/help/editing/overview',
    footerRight: 'Inline cell editing',
  },
  {
    id: 'headless',
    eyebrow: 'Architecture',
    headline: 'Headless-first. Render-ready.',
    body: 'Use the full-featured grid as-is, or drive the headless controller and render every cell yourself. Your markup, your styles.',
    hashtags: ['Svelte', 'Headless'],
    link: 'https://svgrid.com/docs/help/headless/overview',
    footerRight: 'Headless architecture',
  },
  {
    id: 'themes',
    eyebrow: 'Theming',
    headline: '20+ themes, or bring your own tokens.',
    body: 'Material, Fluent, Carbon, shadcn, Nord, Dracula and more ship in the box. Every color is a CSS variable you can override.',
    hashtags: ['Svelte', 'CSS'],
    link: 'https://svgrid.com/docs/getting-started/5-theme-and-density',
    footerRight: 'Themeable by design',
  },
  {
    id: 'export',
    eyebrow: 'Export',
    headline: 'CSV and Excel export, built in.',
    body: 'Ship data out with grouping, formatting, and styles intact - no extra library, no server round-trip.',
    hashtags: ['Svelte', 'DataGrid'],
    link: 'https://svgrid.com/docs/help/export',
    footerRight: 'Data export',
  },
  {
    id: 'charts',
    eyebrow: 'Charts',
    headline: 'Select cells, get a chart.',
    body: 'Turn a range of grid data into a live chart with a right-click - bars, lines, pies - and export it as an image.',
    hashtags: ['Svelte', 'DataViz'],
    link: 'https://svgrid.com/docs/help/charts',
    footerRight: 'Integrated charts',
  },
  {
    id: 'server',
    eyebrow: 'Data',
    headline: 'Client-side or server-side, same API.',
    body: 'Point the grid at an array or a server data source - sorting, filtering, grouping, and paging follow the data either way.',
    hashtags: ['Svelte', 'SvelteKit'],
    link: 'https://svgrid.com/docs/help/server-side-data',
    footerRight: 'Server data source',
  },
  {
    id: 'a11y',
    eyebrow: 'Accessibility',
    headline: 'Keyboard-first and screen-reader ready.',
    body: 'Full keyboard navigation, focus management, and WCAG-minded roles - because a data table everyone can use is the point.',
    hashtags: ['Svelte', 'a11y'],
    link: 'https://svgrid.com/docs/help/accessibility',
    footerRight: 'Accessible by default',
  },
]
