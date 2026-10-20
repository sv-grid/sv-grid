/**
 * "Make Claude write SvGrid right the first time" - three setup steps that
 * cut the back-and-forth with an AI assistant: the MCP server, its code
 * check, and the Agent Skill. TikTok photo mode.
 *
 * Slide 2 is a skit; the mistakes in it are the ones slide 5 shows the real
 * svgrid_check_code catching (run 2026-10-20 against @svgrid/grid 3.0.16 on
 * the Orders.svelte in CHECKED below: key -> field, title -> header,
 * pagination -> pageable, and the `export let` warning). Line numbers stay
 * off slide 5: the check reported the `export let` on line 2 when it is on
 * line 3. The install commands are docs/help/mcp-server.md and AGENTS.md;
 * the tool list is listedTools() in packages/mcp/src/index.ts.
 */
import { demo, stageSnippet } from '../lib/shots.mjs'

const FEATURES = 'getting-started-2-first-grid--2'
const ME = { who: 'You', av: 'ME', me: true }
const CLAUDE = { who: 'Claude', av: 'AI' }

export default {
  id: 'claude-speed',
  caption:
    'Claude writes Svelte fast. Give it the SvGrid MCP server and it stops guessing prop names: it searches the docs and demos for your version, checks its own component, and hands back the fixed file. The Agent Skill adds the house rules (Svelte 5 runes, --sg-* theming). Free. Docs: svgrid.com/mcp',
  hashtags: ['claudecode', 'claude', 'svelte', 'sveltejs', 'mcp', 'aicoding', 'webdev', 'programming', 'devtips'],
  slides: [
    {
      kind: 'title',
      title: 'Make Claude write ==SvGrid== right the first time.',
      body: 'Three setup steps. Each takes about a minute.',
      shot: demo('02-sort-filter-paginate', { width: 820, height: 900 }),
    },
    {
      kind: 'chat',
      title: 'Without them, it ==guesses==.',
      chat: [
        { ...ME, text: 'Add a sortable, paged orders table with SvGrid.' },
        { ...CLAUDE, text: 'Done! Columns use `key` and `title`, paging is `pagination`.' },
        { ...ME, text: 'None of those exist.' },
      ],
    },
    {
      kind: 'code',
      title: '1. Give it the ==real docs==.',
      code: 'claude mcp add svgrid \\\n  -- npx -y @svgrid/mcp',
      body: 'The SvGrid MCP server is pinned to a version: its API, every doc page, and the source of 500+ demos.',
    },
    {
      kind: 'code',
      title: 'Five tools it can call.',
      file: '@svgrid/mcp',
      code: [
        'svgrid_search      docs, demos, API',
        'svgrid_get         a page or demo, in full',
        'svgrid_check_code  verify a file, fix it',
        'svgrid_preview     a live grid in the chat',
        'svgrid_scaffold    SvelteKit files',
      ].join('\n'),
      body: 'Search and check are free. Scaffold is SvGrid Studio.',
    },
    {
      kind: 'code',
      title: '2. Let it ==check its own code==.',
      file: 'svgrid_check_code  Orders.svelte',
      code: [
        'key         -> field',
        'title       -> header',
        'pagination  -> pageable',
        'export let  -> $props()',
        '',
        '5 errors, 1 warning',
        'checked against @svgrid/grid 3.0.16',
        'returned: the fixed file',
      ].join('\n'),
      body: 'It checks the real exported API and compiles the file, so a wrong prop fails before you run anything.',
    },
    {
      kind: 'shot',
      title: 'Then it ==just runs==.',
      code: '<SvGrid data={seed} {columns}\n  sortable filterable pageable\n  pageSize={2} />',
      shot: stageSnippet(FEATURES, { width: 660 }),
    },
    {
      kind: 'code',
      title: '3. Teach it the ==house rules==.',
      code: 'npx skills add sv-grid/sv-grid',
      body: 'The SvGrid Agent Skill loads on its own: Svelte 5 runes, never `export let`, imports from `@svgrid/grid`, theming with `--sg-*` variables.',
    },
    {
      kind: 'code',
      title: 'No MCP client?',
      code: 'svgrid.com/llms-full.txt',
      body: 'Every doc page in one file. Paste it into any assistant.',
    },
    {
      kind: 'end',
      title: 'svgrid.com/mcp',
      lines: ['MCP server and docs: free', 'Grid: `npm i @svgrid/grid`, MIT'],
    },
  ],
}

/** The file slide 5's check ran on, kept so the slide can be re-derived. */
export const CHECKED = `<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  export let orders = []
  const columns = [
    { key: 'id', title: 'Order' },
    { key: 'total', title: 'Total' },
  ]
</script>

<SvGrid data={orders} {columns} sortable pagination />
`
