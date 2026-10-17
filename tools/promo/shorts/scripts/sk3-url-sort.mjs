/**
 * "Keep your grid's sort in the URL, the SvelteKit 3 way."
 *
 * Beat 2's error is the real svelte-check output for that line on SvelteKit
 * 3.0.1 (reproduced in tutorials-out/app/kit3-orders on 2026-10-11). Beats 3-4
 * are the app's actual sort handler (the parameter type left out). The
 * browser beats assert what they show: the sort lands in the URL, and a fresh
 * load of that URL comes back sorted.
 */
const header = (p, name) => p.locator('[role="columnheader"]', { hasText: name }).first()

export default {
  id: 'sk3-url-sort',
  series: 'SvelteKit 3 · SvGrid',
  posterBeat: 1,
  caption: "Keep your data grid's sort in the URL on SvelteKit 3: copy page.url from its href (page.url is read-only in v3), set the params, goto(next, { reset: false }). Reloads and shared links keep the sort. Real SvelteKit 3.0.1 app with SvGrid.",
  hashtags: ['sveltekit', 'sveltekit3', 'svelte', 'webdev', 'javascript', 'typescript', 'programming'],
  clips: {
    sort: {
      app: 'kit3',
      path: '/orders',
      actions: [
        { at: 0.8, run: (p) => header(p, 'Total').click() },
        { at: 2.4, run: (p) => header(p, 'Total').click() },
      ],
      async assert(page) {
        if (!/sort=total&dir=desc/.test(page.url())) throw new Error(`sort did not reach the URL: ${page.url()}`)
      },
    },
    reload: {
      app: 'kit3',
      path: '/orders?sort=total&dir=desc',
      async assert(page) {
        const first = await page.locator('[data-svgrid-row="0"]').last().textContent()
        if (!/\$9\d\d\.\d\d/.test(first ?? '')) throw new Error(`a fresh load of the sorted URL starts with "${first}"`)
      },
    },
  },
  beats: [
    { kind: 'title', title: "Keep your grid's sort ==in the URL.==", sub: 'The SvelteKit 3 way.', mood: 'neutral',
      say: "[excited] Want your grid's sort to survive a reload? Put it in the URL. [beat] Here's the SvelteKit three way." },
    { kind: 'code', file: 'orders/+page.svelte', mood: 'worried', cap: '!!Careful:!! `page.url` is read-only', size: 27,
      code: "const sp = new URLSearchParams(page.url.searchParams)\nsp.set('sort', 'total')",
      typeUntil: 0.3, errorAt: 0.42,
      error: {
        line: 1, col: 31, len: 21, tipTop: 150, title: 'svelte-check',
        text: "Argument of type 'ReadonlyURLSearchParams' is not assignable to parameter of type 'string | URLSearchParams | string[][] | Record<string, string> | undefined'. Type 'ReadonlyURLSearchParams' is missing the following properties from type 'URLSearchParams': append, delete, set, sort",
      },
      say: '[warning] Careful. In SvelteKit three, page dot url is read only. [beat] Copying its search params like this... no longer type checks.' },
    { kind: 'code', file: 'orders/+page.svelte', mood: 'determined', cap: 'Copy it from ==`href`==', size: 28,
      code: "function onSortingChange(sorting) {\n  const next = new URL(page.url.href)\n  if (sorting.length === 0) {\n    next.searchParams.delete('sort')\n    next.searchParams.delete('dir')\n  } else {\n    next.searchParams.set('sort', sorting[0]!.id)\n    next.searchParams.set('dir',\n      sorting[0]!.desc ? 'desc' : 'asc')\n  }\n  goto(next, { reset: false })\n}",
      focus: [2], focusAt: 0.4,
      say: 'Copy the URL from its href instead. Set the sort... and navigate with goto.' },
    { kind: 'code', file: 'orders/+page.svelte', mood: 'happy', cap: '`reset: false` ==keeps your place==', size: 28,
      code: "function onSortingChange(sorting) {\n  const next = new URL(page.url.href)\n  if (sorting.length === 0) {\n    next.searchParams.delete('sort')\n    next.searchParams.delete('dir')\n  } else {\n    next.searchParams.set('sort', sorting[0]!.id)\n    next.searchParams.set('dir',\n      sorting[0]!.desc ? 'desc' : 'asc')\n  }\n  goto(next, { reset: false })\n}",
      typeUntil: 0.001, focus: [11], focusAt: 0,
      say: 'Reset false keeps the scroll position and the focus right where they are.' },
    { kind: 'browser', clip: 'sort', mood: 'happy', cap: 'Click a header: ==the URL changes==',
      say: '[impressed] Click a header. The URL changes, the server sorts, and the page keeps its place.' },
    { kind: 'browser', clip: 'reload', mood: 'happy', cap: 'Reload it. ==Same sort.==',
      say: 'Reload it, or send the link. [beat] Same sort.' },
    { kind: 'end', title: 'Sort in the URL,\n==on SvelteKit 3.==', mood: 'happy',
      say: '[upbeat] SvGrid. Follow for more SvelteKit three.' },
  ],
}
