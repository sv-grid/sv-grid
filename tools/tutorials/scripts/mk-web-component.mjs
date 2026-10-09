/**
 * The web component: install it, use it, and the one rule that catches everyone.
 *
 * Lands on docs/help/web-components.md, the section index, which has twelve
 * pages and no video.
 *
 * Recorded against `packages/grid-wc/demo.html`, the package's own page, served
 * by its own `preview` script (`appScaffold.dir` + `script` + `port`). Nothing
 * is scaffolded or installed: it is the working tree, so if someone changes the
 * element and the page stops working, this video stops recording.
 *
 * The install commands and the attribute-versus-property rule are taken from
 * docs/help/web-components/quick-start.md so the video and the page agree.
 */
export default {
  id: 'mk-web-component',
  kind: 'marketing',
  docsPage: 'docs/help/web-components.md',
  anchor: '## Start here',
  player: true,
  title: 'A data grid web component: one script tag, any framework',
  // No angle brackets: YouTube rejects a description containing them outright
  // with invalidDescription, which is why this says sv-grid and not the tag.
  description: 'Install @svgrid/grid-wc from a CDN or npm, use the sv-grid element in plain HTML, and learn the attribute-versus-property rule that catches everyone first.',
  tags: ['web component', 'custom element', 'data grid', 'sv-grid', 'javascript data grid', 'html data grid', 'framework agnostic'],
  view: { width: 1920, height: 1080 },
  appScaffold: { dir: 'packages/grid-wc', script: 'preview', port: 4205, readyPath: '/demo.html' },
  poster: { beat: 2 },
  gif: { beats: [2, 2] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Web component',
          title: 'One script tag. Any framework.',
          subtitle: 'Or none at all.',
        })
      },
      beats: [
        {
          say: 'The grid is written in Svelte, but you do not have to be. It also ships as a custom element, which is a browser standard: one script tag, one HTML tag, and it works in React, Vue, Angular, Rails, Django, a static page, or whatever you already have. No bundler and no framework in your application.',
          lead: 300,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('terminal', { title: 'Terminal' })
      },
      beats: [
        {
          say: 'There are two ways in. From npm, if you have a build step, where importing the package registers the element as a side effect. Or straight from a CDN with a script tag, if you do not, in which case there is nothing to install at all.',
          lead: 350,
          async do(page, h) {
            await h.stage.term.run('npm install @svgrid/grid-wc', {
              typeMs: 34,
              output: [
                { text: '', after: 600 },
                { text: 'added 1 package in 1s', cls: 'dim' },
              ],
            })
            await h.pause(900)
          },
          hold: 300,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'index.html' })
      },
      beats: [
        {
          say: 'And this is the whole of it in a plain HTML file. A module script pointing at the package, the element itself with the features you want switched on as attributes, and then two properties set from JavaScript: the columns and the rows.',
          lead: 350,
          async do(page, h) {
            await h.stage.editor.type(
              [
                '<script type="module"',
                '        src="https://unpkg.com/@svgrid/grid-wc"></script>',
                '',
                '<sv-grid id="grid" sortable filterable',
                '         style="display:block;height:420px"></sv-grid>',
                '',
                '<script type="module">',
                "  const grid = document.getElementById('grid')",
                "  grid.columns = [{ field: 'name', header: 'Name' }]",
                '  grid.data = rows',
                '</script>',
              ].join('\n'),
              { typeMs: 16 },
            )
            await h.pause(2000)
          },
          hold: 400,
        },
        {
          say: 'That split is the one rule worth learning first, and it is where everyone trips. Attributes are strings, so sortable and filterable work as attributes. Anything that is not a string is a property only. Set columns as an attribute and the browser turns your array into the text object Object, and you get an empty grid with no error to tell you why.',
          lead: 350,
          async do(page, h) {
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },

    {
      app: '/demo.html',
      zoom: 1.6,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-grid-body [role="row"]', { timeout: 40_000 })
        await h.pause(900)
      },
      beats: [
        {
          say: 'Here is that page running. This is the real custom element, not a Svelte component in disguise: the grid you see was created by the browser from an HTML tag. Sorting, the filter menus, currency formatting on a column, row selection. Everything the grid does, it does here.',
          lead: 350,
          async do(page, h) {
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the custom element rendered ${rows} rows`)
            // It must really be a custom element, not a Svelte island: ask the
            // browser whether the tag is registered. If this ever returns false
            // the video's whole premise is wrong and the take should fail.
            const defined = await page.evaluate(() => Boolean(customElements.get('sv-grid')))
            if (!defined) throw new Error('customElements.get("sv-grid") is undefined: this is not a registered custom element')
            h.log(`<sv-grid> is a registered custom element rendering ${rows} rows`)
            await h.callout(page.locator('sv-grid').first(), 'a browser element, not a framework component', { hold: 1700 })
            await h.clearCallout()
          },
          hold: 300,
        },
        {
          say: 'And it talks back the way a browser element should. Click a row and it fires a DOM event you listen for with add event listener, like any other element on the page. No framework bindings, no adapter, nothing to import. That is what makes it work the same in all of them.',
          lead: 350,
          async do(page, h) {
            const log = page.locator('#log')
            await h.clickCell(1, 0)
            await h.pause(1200)
            const text = (await log.innerText()).trim()
            if (!/rowclick|selected/i.test(text)) {
              throw new Error(`clicking a row logged "${text}": no DOM event reached the listener`)
            }
            h.log(`DOM event fired: ${text.slice(0, 80)}`)
            await h.callout(log, 'a plain DOM event', { place: 'above', hold: 1700 })
            await h.clearCallout()
          },
          hold: 400,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'Web component',
          title: '<sv-grid>',
          subtitle: 'React, Vue and Angular wrappers ship in the same package.',
          lines: ['svgrid.com/docs/help/web-components'],
        })
      },
      beats: [
        {
          say: 'If you do use a framework, the package also ships thin wrappers for React, Vue and Angular, so props and events look native in each. The docs have a page per framework, the attribute and property reference, and what the shadow DOM build changes. The grid is MIT on npm.',
          lead: 300,
        },
      ],
    },
  ],
}
