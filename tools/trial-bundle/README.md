# SvGrid Enterprise trial

Thank you for trying SvGrid. This folder has everything to evaluate it
without a network connection:

| Folder / file | What it is |
| --- | --- |
| `packages/{{GRID_TGZ}}` | `@svgrid/grid` {{GRID_VERSION}}, the MIT data grid and UI components |
| `packages/{{ENTERPRISE_TGZ}}` | `@svgrid/enterprise` {{ENTERPRISE_VERSION}}: {{ENTERPRISE_FEATURES}} |
| `demos/` | The demo browser: every live example from svgrid.com/demos, with its source |
| `start-demos.cmd`, `start-demos.sh`, `serve.mjs` | Start the demo browser on your machine |

Built {{BUILT}}.{{GALLERY_NOTE}}

## 1. Browse the demos

You need [Node.js](https://nodejs.org) 18 or newer.

- Windows: double-click `start-demos.cmd`.
- macOS and Linux: run `./start-demos.sh` in a terminal.
- Or, anywhere: `node serve.mjs`.

Your browser opens the gallery at `http://localhost:5175/demos/`, the same
page as https://svgrid.com/demos. Pick a demo on the left; the Source button
shows the Svelte code that draws it, ready to copy. Links to the docs,
pricing and the playground open on svgrid.com.
Opening `demos/index.html` directly does not work: browsers block module
scripts and WebAssembly on `file://` addresses, which is why the small
server is there.

## 2. Use SvGrid in your app

SvGrid is a library you import, not a project on its own: installing it into
an empty folder only creates a `node_modules` folder with nowhere to put a
component. You need a Svelte 5 or SvelteKit app. If you do not have one yet,
scaffold one with Enterprise already wired in:

```bash
npm create @svgrid@latest my-grid-app -- --template pivot-dashboard
cd my-grid-app
npm install
npm run dev
```

In that app (or your own), install both packages from this folder:

```bash
npm install ./path/to/packages/{{GRID_TGZ}} ./path/to/packages/{{ENTERPRISE_TGZ}}
```

or from npm, the same code:

```bash
npm install @svgrid/grid @svgrid/enterprise
```

Then render a grid from a component (`src/App.svelte` in a Vite app, a
`+page.svelte` in SvelteKit), and run `npm run dev`:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import '@svgrid/grid/themes/ember.css'

  const rows = [
    { name: 'Ada Lovelace', city: 'London' },
    { name: 'Grace Hopper', city: 'New York' },
  ]
  const columns = [
    { field: 'name', header: 'Name' },
    { field: 'city', header: 'City' },
  ]
</script>

<SvGrid data={rows} {columns} sortable filterable editable />
```

The getting-started guide is at https://svgrid.com/docs/getting-started/ and
every demo's source is in the gallery.

## 3. During the trial

Every Enterprise feature runs in full. Until a license key is set, a small
watermark shows and the console prints one notice; nothing is disabled and
nothing stops working.

**30 days of email support.** For 30 days from your download, write to
support@jqwidgets.com from the address you gave us with any question about
SvGrid: setup, a feature, a bug, how to build something. Engineers who
work on SvGrid answer.

## 4. Buy

Licenses are per developer and cover unlimited apps and end users. Prices
start at $299 per developer: https://svgrid.com/pricing/

After you buy, set your key once at startup and the watermark goes away:

```ts
import { setLicenseKey } from '@svgrid/enterprise'

setLicenseKey('your-license-key')
```

Questions about licensing: sales@jqwidgets.com
