/**
 * "Upgrade to SvelteKit 3 in one command (with a data grid in the app)."
 *
 * Everything on screen happened on 2026-10-11 in tutorials-out/app/migrate-demo,
 * a copy of the create-sv-grid SvelteKit 2 template:
 *   - `npx sv migrate sveltekit-3 --tasks all --confirm --install npm` (sv
 *     1.1.1) printed the task list and "All tasks applied successfully!";
 *   - svelte-check then reported 2 errors, both in the grid page's sort handler
 *     (the error lines below are its output, trimmed where marked with ...);
 *   - MIGRATION_TASKS.md listed both fixes; the diff is the two lines changed;
 *   - svelte-check reported 0 errors and `vite build` finished.
 * The browser beat records that migrated app, signed in as the template's
 * demo admin, and asserts the sort reaches the URL.
 */
const header = (p, name) => p.locator('[role="columnheader"]', { hasText: name }).first()

export default {
  id: 'sk3-migrate',
  series: 'SvelteKit 3 · SvGrid',
  posterBeat: 2,
  caption: 'Upgrading a SvelteKit 2 app with a data grid to SvelteKit 3: npx sv migrate sveltekit-3 runs 12 tasks, the type check then finds 2 errors in the grid sort handler, and MIGRATION_TASKS.md says how to fix them: copy page.url via href, and goto(next, { reset: false }). Zero errors, it builds, the SvGrid grid runs.',
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'javascript', 'migration', 'programming'],
  clips: {
    migrated: {
      app: 'migrated',
      path: '/people',
      login: { email: 'admin@example.com', password: 'password' },
      actions: [
        { at: 0.8, run: (p) => header(p, 'Year').click() },
        { at: 2.3, run: (p) => header(p, 'Year').click() },
      ],
      async assert(page) {
        if (!/sort=year&dir=desc/.test(page.url())) throw new Error(`sort did not reach the URL: ${page.url()}`)
      },
    },
  },
  beats: [
    { kind: 'title', title: 'SvelteKit 3 in ==one command.==', sub: 'With a data grid in the app.', mood: 'neutral',
      say: '[confident] Upgrading a SvelteKit two app with a data grid... to SvelteKit three. One command.' },
    { kind: 'terminal', mood: 'neutral', cap: 'The official ==migrator==', minHeight: 640,
      lines: [
        { cmd: 'npx sv migrate sveltekit-3 --tasks all --confirm --install npm', at: 0 },
        { text: '◇  Migration steps', cls: 'dim', at: 0.15 },
        { text: '   - svelte-config (Migrate svelte.config.* to vite.config.*)', at: 0.22 },
        { text: '   - environment (Migrate to explicit environment variables ($app/env))', at: 0.29 },
        { text: '   - lib-alias (Replace the $lib alias with #lib subpath imports)', at: 0.36 },
        { text: '   - app-state (Migrate from "$app/stores" to "$app/state")', at: 0.43 },
        { text: '   + 8 more tasks', cls: 'dim', at: 0.5 },
        { text: '◇  All tasks applied successfully!', cls: 'ok', at: 0.7 },
      ],
      say: 'The official migrator runs twelve tasks. Config, env, imports, dollar lib, app state.' },
    { kind: 'terminal', mood: 'worried', cap: 'Then: !!2 errors!!', minHeight: 640,
      lines: [
        { cmd: 'npm run check', at: 0 },
        { text: 'Error: Argument of type \'Readonly<Omit<URL, "searchParams"> & { searchParams: ReadonlyURLSearchParams; }> ...', cls: 'err', at: 0.25 },
        { text: "Error: Object literal may only specify known properties, and 'keepFocus' does not exist in type 'GotoOptions'. (ts)", cls: 'err', at: 0.4 },
        { text: 'svelte-check found 2 errors and 0 warnings in 1 file', cls: 'hl', at: 0.55 },
      ],
      say: '[worried] Then the type check. Two errors. [beat] Both in the grid\'s sort handler.' },
    { kind: 'code', file: 'people/+page.svelte', mood: 'determined', cap: 'The migrator ==lists the fix==', diff: true, size: 26,
      code: '- const next = new URL(page.url)\n+ const next = new URL(page.url.href)\n\n- goto(next, { keepFocus: true, noScroll: true })\n+ goto(next, { reset: false })',
      say: 'Its task list says exactly what to do. Copy page dot url from its href. Swap keep focus and no scroll for reset.' },
    { kind: 'terminal', mood: 'happy', cap: '++0 errors.++ It builds.', minHeight: 640,
      lines: [
        { cmd: 'npm run check', at: 0 },
        { text: 'svelte-check found 0 errors and 0 warnings', cls: 'ok', at: 0.2 },
        { cmd: 'npm run build', at: 0.4 },
        { text: '✔ done', cls: 'ok', at: 0.6 },
      ],
      say: '[relieved] Two lines later. Zero errors. And it builds.' },
    { kind: 'browser', clip: 'migrated', mood: 'happy', cap: 'The grid, ==on SvelteKit 3==',
      say: 'And the data grid runs on SvelteKit three.' },
    { kind: 'end', title: 'Upgraded,\n==on SvelteKit 3.==', mood: 'happy',
      say: '[upbeat] SvGrid. Follow for more SvelteKit three.' },
  ],
}
