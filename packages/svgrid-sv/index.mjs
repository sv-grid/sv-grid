/**
 * `npx sv add @svgrid` - the SvGrid add-on for the Svelte CLI.
 *
 * Deliberately dependency-free. The community add-on contract forbids regular
 * dependencies and expects everything but `sv` to be bundled, so rather than
 * take on `@sveltejs/sv-utils` plus a bundler step for what amounts to two
 * dependency lines and one file, this uses only `sv`'s own API and ships as a
 * single hand-written module.
 *
 * API verified against sv@0.17.0. Community add-ons are still marked
 * experimental upstream, so treat the shape here as pinned to that version.
 */
import { defineAddon, defineAddonOptions } from 'sv'

// Ranges rather than exact pins: the grid follows semver and a user running
// `sv add` months from now should get current patches.
const GRID = '^2.6.0'
const ENTERPRISE = '^2.6.0'

/** The starter component, in whichever language the project already uses. */
function demoComponent(language) {
  const ts = language === 'ts'
  const open = ts ? '<script lang="ts">' : '<script>'
  // The JS variant still needs the column type. SvelteKit's JS template turns
  // on `checkJs`, and without an annotation `field` widens to `string`, which
  // does not satisfy the key union ColumnDef narrows it to.
  const columnsDecl = ts
    ? 'const columns: GridColumns<(typeof data)[number]> = ['
    : "/** @type {import('@svgrid/grid').GridColumns<(typeof data)[number]>} */\n  const columns = ["
  const importLine = ts
    ? "import { SvGrid, type GridColumns } from '@svgrid/grid'"
    : "import { SvGrid } from '@svgrid/grid'"

  return `${open}
  ${importLine}
  // The house theme - what the demos use. Swap for any preset in @svgrid/grid/themes.
  import '@svgrid/grid/themes/ember.css'

  const data = [
    { name: 'Ada Lovelace', role: 'Mathematician', year: 1843 },
    { name: 'Grace Hopper', role: 'Rear Admiral', year: 1952 },
    { name: 'Karen Sparck Jones', role: 'Computer Scientist', year: 1972 },
  ]

  ${columnsDecl}
    { field: 'name', header: 'Name' },
    { field: 'role', header: 'Role' },
    { field: 'year', header: 'Year' },
  ]
</script>

<SvGrid {data} {columns} sortable filterable />
`
}

export default defineAddon({
  id: 'svgrid',
  shortDescription: 'Svelte 5 data grid',
  homepage: 'https://svgrid.com',

  options: defineAddonOptions()
    .add('demo', {
      question: 'Add a demo grid so you can see it working?',
      type: 'boolean',
      default: true,
    })
    .add('enterprise', {
      question: 'Add the Enterprise pack (Excel/PDF export, pivot, Kanban, scheduler)? Needs a paid license key.',
      type: 'boolean',
      default: false,
    })
    .build(),

  setup: ({ dependencyVersion, unsupported }) => {
    // SvGrid is Svelte 5 only by design - it is built on runes and snippets
    // rather than stores, so there is no graceful degradation to offer.
    const svelte = dependencyVersion('svelte')
    if (!svelte) return
    const major = Number.parseInt(svelte.replace(/^\D*/, ''), 10)
    if (Number.isFinite(major) && major < 5) {
      unsupported('SvGrid requires Svelte 5 - it is built on runes and snippets.')
    }
  },

  run: ({ sv, options, language, isKit, directory }) => {
    sv.dependency('@svgrid/grid', GRID)
    if (options.enterprise) sv.dependency('@svgrid/enterprise', ENTERPRISE)

    if (!options.demo) return

    const path = isKit
      ? `${directory.kitRoutes}/svgrid-demo/+page.svelte`
      : `${directory.lib}/SvGridDemo.svelte`

    sv.file(path, (content) => {
      // Never clobber a file the user already has.
      if (content.trim()) return false
      return demoComponent(language)
    })
  },

  nextSteps: ({ options, isKit, directory }) => {
    const steps = []
    if (options.demo) {
      steps.push(
        isKit
          ? 'Run your dev server and open /svgrid-demo'
          : `Import the demo component from ${directory.lib}/SvGridDemo.svelte`,
      )
    }
    steps.push('Docs: https://svgrid.com/docs/')
    if (options.enterprise) {
      steps.push('Enterprise needs a license key - see https://svgrid.com/pricing/')
    }
    return steps
  },
})
