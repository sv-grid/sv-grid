/**
 * SvGrid Design Kit plugin entry. Builds three pages:
 *   Overview (cover and foundations), Grid (screens, examples, parts), Components
 * Re-running updates the variables and styles in place and rebuilds the pages.
 */
import { KIT, fallbackThemes, flushStyleLinks, loadFonts, modeIds, setupEffectStyles, setupTextStyles, setupVariables, COLLECTION_NAME } from './lib'
import { EFFECTS, TYPE, cardErrors, cardOf, errorCard, finishCards, heading, layoutPage, pageHeader } from './doc'
import { buildCover, buildFoundations } from './foundations'
import { buildGridExamples, buildGridParts } from './grid'
import { buildMoreGridParts } from './grid2'
import { buildUi } from './ui'

/** The Grid page in groups; cards are matched by title. */
const GRID_GROUPS: [string, string, string[]][] = [
  ['Screens and examples', 'The grid assembled: a full screen, the example grid in every theme, and its main states.', ['Orders screen', 'Data grid', 'Themes and density', 'States']],
  ['Header', 'Column headers, multi-level group headers and the header extras.', ['Header cell', 'Column groups and header extras']],
  ['Cells', 'Data cells and their states, what a cell can carry, and the utility columns.', ['Body cell', 'Cell decorations', 'Selection column', 'Row numbers and detail toggle']],
  ['Rows', 'Group, tree, pinned, summary and total rows.', ['Group and tree rows', 'Pinned rows, summary and totals']],
  ['Grid chrome', 'Everything around the cells: pager, toolbar, status bar, find, panels, scrollbars, loading.', ['Pager and toolbar', 'Status bar, find and tool panel', 'Filter row, scrollbar, loading', 'Loading and empty', 'Selection bar']],
  ['Menus', 'Column, filter, context and operator menus, and the cell tooltip.', ['Menus', 'More menus and tooltip']],
]

function groupGridCards(stages: SceneNode[]): SceneNode[] {
  const byTitle = new Map(stages.map((s) => [cardOf(s).name, s]))
  const out: SceneNode[] = []
  for (const [title, blurb, names] of GRID_GROUPS) {
    const found = names.map((n) => byTitle.get(n)).filter((n): n is SceneNode => !!n)
    if (!found.length) continue
    out.push(heading(title, blurb), ...found)
    for (const n of names) byTitle.delete(n)
  }
  return [...out, ...byTitle.values()]
}

// Figma's Starter plan allows three pages per file, so the kit fits in three.
const PAGES = ['Overview', 'Grid', 'Components'] as const
type PageName = (typeof PAGES)[number]
/** Page names earlier versions of the plugin used; removed on a re-run. */
const RETIRED = ['Grid components', 'Grid examples', 'Foundations', 'UI components']

/**
 * Find or make the kit pages without going over the plan's page limit: reuse
 * kit pages by name (emptied), then pages from older versions of the kit,
 * then an empty untouched "Page N", and only then create a page.
 */
async function kitPages(): Promise<Record<PageName, PageNode>> {
  const out = {} as Record<PageName, PageNode>
  const taken = new Set<PageNode>()
  for (const name of PAGES) {
    const p = figma.root.children.find((x) => x.name === name)
    if (p) {
      out[name] = p
      taken.add(p)
    }
  }
  const retired = figma.root.children.filter((p) => RETIRED.includes(p.name))
  for (const name of PAGES) {
    if (out[name]) continue
    let page: PageNode | undefined = retired.shift()
    if (!page) {
      for (const p of figma.root.children) {
        if (taken.has(p) || !/^Page \d+$/.test(p.name)) continue
        await p.loadAsync()
        if (p.children.length === 0) {
          page = p
          break
        }
      }
    }
    if (!page) {
      try {
        page = figma.createPage()
      } catch {
        throw new Error(`The kit needs ${PAGES.length} pages (${PAGES.join(', ')}) and this file has no room for "${name}". Run it in a new file.`)
      }
    }
    page.name = name
    out[name] = page
    taken.add(page)
  }
  for (const p of retired) {
    if (figma.currentPage === p) await figma.setCurrentPageAsync(out.Overview)
    p.remove()
  }
  // Keep the kit pages first, in order.
  PAGES.forEach((name, i) => figma.root.insertChild(i, out[name]))
  for (const name of PAGES) {
    await out[name].loadAsync()
    for (const child of [...out[name].children]) child.remove()
  }
  return out
}

async function run(): Promise<void> {
  await loadFonts()
  await setupVariables()
  await setupEffectStyles(EFFECTS)
  await setupTextStyles(TYPE)

  const pages = await kitPages()
  const failures: string[] = []

  /**
   * Build one page while it is current (figma.create*() appends to the
   * current page). A failure leaves an error card on that page and the rest
   * of the kit still builds.
   */
  async function buildPage<T>(name: PageName, build: () => T, frames: (result: T) => SceneNode[], above?: (result: T) => FrameNode | undefined): Promise<T | null> {
    figma.notify(`SvGrid kit: building ${name}...`, { timeout: 1500 })
    await figma.setCurrentPageAsync(pages[name])
    try {
      const result = build()
      finishCards()
      layoutPage(pages[name], frames(result), { above: above?.(result) })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      failures.push(`${name}: ${msg}`)
      layoutPage(pages[name], [errorCard(name, msg)])
      return null
    }
  }

  // Components first: the grid uses its buttons, inputs and badges.
  const ui = await buildPage('Components', buildUi, (r) => [
    pageHeader('Components', 'The UI kit that ships in @svgrid/grid next to the grid, in seven groups. Each card has the Svelte usage, the props that change the look, the file it was measured from, and every variant in Light and Dark.'),
    ...r.sections,
  ])

  const grid = ui
    ? await buildPage(
        'Grid',
        () => {
          const parts = buildGridParts(ui.kit)
          const more = buildMoreGridParts()
          // The examples are built from the parts; if they fail, the parts
          // still get laid out and the failure shows where the examples go.
          let examples: ReturnType<typeof buildGridExamples> | null = null
          let examplesError: FrameNode | null = null
          try {
            examples = buildGridExamples(parts.parts, ui.kit)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(err)
            failures.push(`Grid examples: ${msg}`)
            examplesError = errorCard('Grid examples', msg)
          }
          return { parts, more, examples, examplesError }
        },
        (r) => [
          pageHeader('Grid', 'SvGrid, assembled and taken apart. A full screen and the example grids come first; every part they are built from follows, with its states as a matrix in Light and Dark.'),
          ...(r.examplesError ? [r.examplesError] : []),
          ...groupGridCards([...(r.examples ? r.examples.sections : []), ...r.parts.sections, ...r.more.sections]),
        ],
      )
    : null

  let cover: FrameNode | null = null
  await buildPage(
    'Overview',
    () => {
      const screen = grid?.examples?.screen
      cover = screen ? buildCover(screen) : null
      return buildFoundations({ screen, kit: ui?.kit })
    },
    (r) => r,
    () => cover ?? undefined,
  )

  await flushStyleLinks()
  if (cover) {
    try {
      await figma.setFileThumbnailNodeAsync(cover)
    } catch (err) {
      failures.push(`Thumbnail: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  await figma.setCurrentPageAsync(pages.Overview)
  figma.viewport.scrollAndZoomIntoView(pages.Overview.children)

  const themes = fallbackThemes.length ? ` Themes in their own collections (plan limit): ${fallbackThemes.join(', ')}.` : ''
  const built = Object.keys(modeIds[COLLECTION_NAME] ?? {}).length
  failures.push(...cardErrors)
  const done = failures.length ? `SvGrid kit failed on ${failures.join('; ')}` : `SvGrid kit built: ${built} of ${KIT.modes.length} theme modes, ${PAGES.length} pages.${themes}`
  figma.closePlugin(done)
}

run().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(err)
  figma.closePlugin(`SvGrid kit failed: ${msg}`)
})
