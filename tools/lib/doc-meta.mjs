/**
 * The one doc-page model shared by every consumer of docs/**.md: the docs index
 * builder (docs.json, llms.txt), the prerenderer, the website's docs module and
 * the MCP manifest build. Each of them used to carry its own copy of the
 * hidden-page sets and the title parser, and the copies drifted: docs/reference
 * was prerendered and sitemapped while the SPA could not route it. Dependency
 * free so Vite can bundle it and a fresh clone can run it without an install.
 */

// Slugs with no route. A page listed here is neither prerendered nor indexed.
export const HIDDEN_SLUGS = new Set([
  'examples-plan',      // historical planning doc
  'help/index',         // duplicate of the sidebar itself
  'recipes/index',      // ditto - the sidebar IS the index
  'compliance/index',
  'reference/index',
  'enterprise/README',  // landing already lives under the Enterprise group
  'help/api-reference', // duplicate of the /api page
])

// Whole trees with no route: planning notes, the auto API reference (the /api
// page is the real one), and the non-developer legal / brand / schema trees.
export const HIDDEN_PREFIXES = ['_internal/', 'reference/', 'legal/', 'brand/', 'schemas/']

export function isHiddenDoc(slug) {
  return HIDDEN_SLUGS.has(slug) || HIDDEN_PREFIXES.some((p) => slug.startsWith(p))
}

/**
 * Trees that stay unrouted for humans but ARE handed to models in
 * llms-full.txt.
 *
 * `docs/reference/` is the full typed API surface, every symbol documented. It
 * has no route on purpose - the /api page is the human-facing one, and routing
 * both would be duplicate content. But an assistant answering "what does
 * `tableFeatures` take" has nothing to read otherwise, so it goes in the LLM
 * bundle only: no route, no sitemap entry, no docs.json entry.
 */
export const LLM_ONLY_PREFIXES = ['reference/']

/**
 * Include in llms-full.txt despite having no route. Index pages are excluded -
 * they are sidebars, and repeating them adds noise without content.
 */
export function isLlmOnlyDoc(slug) {
  if (!LLM_ONLY_PREFIXES.some((p) => slug.startsWith(p))) return false
  return !slug.endsWith('/index') && !HIDDEN_SLUGS.has(slug)
}

export const SECTION_TITLES = {
  '': 'Overview',
  'getting-started': 'Getting started',
  help: 'Help',
  'help/cells': 'Cells',
  'help/columns': 'Columns',
  'help/editing': 'Editing',
  'help/filtering': 'Filtering',
  'help/grouping': 'Grouping',
  'help/headless': 'Headless',
  'help/rows': 'Rows',
  'help/server': 'Server data',
  'help/state': 'State & views',
  'help/ui-components': 'UI components',
  recipes: 'Recipes',
  reference: 'API reference',
  'enterprise/studio': 'Studio',
  enterprise: 'Enterprise tier',
  compliance: 'Compliance',
  legal: 'Legal',
  brand: 'Brand',
}

/** Section id for a doc path relative to docs/ (either slash style). */
export function sectionOf(rel) {
  const parts = rel.replace(/\\/g, '/').replace(/\.md$/, '').split('/')
  if (parts.length === 1) return ''
  // Studio is its own section (and pillar), split out of the broad enterprise
  // bucket so its pages do not share a sidebar with licensing and support.
  if (parts[0] === 'enterprise' && parts[1] && parts[1].startsWith('studio')) return 'enterprise/studio'
  if (parts[0] === 'help' && parts.length > 2) return `help/${parts[1]}`
  return parts[0]
}

/**
 * Optional YAML-ish frontmatter on a doc page. The H1 stays the display title;
 * the frontmatter only carries search-facing overrides:
 *
 *   seoTitle, seoDescription, keywords (comma list), noindex (true)
 *
 * Only recognised when the file starts with a `---` line, so the hundreds of
 * existing pages without one parse as before. The body returned has the block
 * removed, which every renderer must use (marked would otherwise draw the
 * `---` as a rule and the keys as a paragraph).
 */
export function parseDocFrontmatter(raw) {
  const original = String(raw ?? '')
  let text = original
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n')
  const meta = {}
  // No block: hand the text back untouched (line endings included), so a
  // consumer that snapshots it (the MCP data bundle) sees no churn.
  if (!text.startsWith('---\n')) return { meta, body: original }
  const end = text.indexOf('\n---', 4)
  if (end === -1) return { meta, body: original }
  for (const line of text.slice(4, end).split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key === 'keywords') meta.keywords = value.split(',').map((s) => s.trim()).filter(Boolean)
    else if (key === 'noindex') meta.noindex = value === 'true'
    else meta[key] = value
  }
  const after = text.indexOf('\n', end + 1)
  return { meta, body: after === -1 ? '' : text.slice(after + 1) }
}

// Search-facing names for the components whose Sv* name does not split into
// the phrase people type. Everything else derives from the camel case.
export const UI_COMPONENT_NAMES = {
  SvCheckBox: 'Checkbox',
  SvComboBox: 'Combobox',
  SvDropDownList: 'Dropdown List',
  SvTextArea: 'Textarea',
  SvOtpInput: 'OTP Input',
  SvNavPane: 'Navigation Pane',
  SvRichText: 'Rich Text Editor',
  SvCommand: 'Command Palette',
  SvTree: 'Tree View',
  SvToaster: 'Toast Notifications',
  SvStat: 'Stat Card',
  SvResult: 'Result Page',
  SvTour: 'Product Tour',
  SvSegmented: 'Segmented Control',
  SvField: 'Form Field',
  SvGridSelect: 'Grid Select Dropdown',
  SvGridDropdown: 'Grid Dropdown',
  SvGridChart: 'Chart',
  SvCalendar: 'Calendar (Date Picker)',
  SvDateTimePicker: 'Date Time Picker',
  SvDateRangeInput: 'Date Range Picker',
  SvPopconfirm: 'Confirm Popover',
  SvHoverCard: 'Hover Card',
  SvScrollArea: 'Scroll Area',
  SvMenubar: 'Menu Bar',
  SvMenuList: 'Menu List',
}

/** "SvDateTimePicker" -> "Date Time Picker"; null when the H1 is not a Sv* name. */
export function uiComponentName(h1) {
  const token = String(h1 ?? '').trim().split(/[\s(/]/)[0]
  if (!/^Sv[A-Z]/.test(token)) return null
  return UI_COMPONENT_NAMES[token] ?? token.replace(/^Sv/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

const TITLE_MAX = 65

/**
 * Default search title for a doc page. Puts the head term ("Svelte ...") into
 * every title the way a query is typed, and falls back to a shorter form when
 * the H1 is long so the result does not truncate. A `seoTitle` in the page's
 * frontmatter wins over this.
 */
export function docSeoTitle({ slug, section, title }) {
  const h1 = String(title ?? '').trim()
  // First variant that fits; a heading too long for any suffix stands alone
  // (those pages get a hand-written seoTitle rather than a truncated one).
  const pick = (variants) => [...variants, h1].find((v) => v.length <= TITLE_MAX) ?? h1
  if (section === 'help/ui-components') {
    const base = slug.slice(slug.lastIndexOf('/') + 1)
    const name = base.startsWith('sv-') ? uiComponentName(h1) : null
    if (name) {
      return pick([
        `Svelte ${name} Component - ${h1} | SvGrid UI`,
        `Svelte ${name} Component - SvGrid UI`,
        `Svelte ${name} Component`,
      ])
    }
    return pick([`${h1} - Svelte UI Components | SvGrid UI`, `${h1} - Svelte UI Components`, `${h1} - Svelte UI`])
  }
  if (section === 'enterprise/studio') {
    return pick([`${h1} - SvGrid Studio for SvelteKit`, `${h1} - Studio for SvelteKit`, `${h1} - SvelteKit`])
  }
  if (section === 'enterprise' || section === 'compliance' || section === 'legal') return pick([`${h1} - SvGrid`])
  if (section === 'recipes') {
    return pick([`${h1} - Svelte Data Grid Recipe | SvGrid`, `${h1} - Svelte Data Grid Recipe`, `${h1} - Svelte Recipe`])
  }
  if (/svelte/i.test(h1)) return pick([`${h1} | SvGrid Docs`])
  return pick([`${h1} - Svelte Data Grid | SvGrid Docs`, `${h1} - Svelte Data Grid`, `${h1} - Svelte | SvGrid`])
}
