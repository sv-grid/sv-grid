import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import rollupReplace from '@rollup/plugin-replace'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error - plain .mjs helper, no types
import { blogCardSvg, rasterizePng, loadBlogCards } from '../tools/blog-card.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const blogDir = path.resolve(__dirname, 'src/content/blog')

// In production the postbuild prerenderer writes the per-post blog cards into
// dist/og/blog/<slug>.{svg,png}. Under `vite dev` those files don't exist, so
// the blog images would 404. This dev-only middleware generates the same card
// on the fly for any /og/blog/<slug>.{svg,png} request, so the images show in
// dev without committing binaries.
function blogCardDevPlugin(): Plugin {
  return {
    name: 'blog-card-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const m = url.match(/\/og\/blog\/([^/?#]+)\.(svg|png)(?:[?#]|$)/)
        if (!m) return next()
        const slug = decodeURIComponent(m[1]!)
        const ext = m[2]
        try {
          const cards = await loadBlogCards(blogDir)
          const post = cards.get(slug)
          if (!post) return next()
          const svg = blogCardSvg(post)
          if (ext === 'svg') {
            res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(svg)
            return
          }
          const png = rasterizePng(svg)
          if (!png) {
            // No rasterizer available in dev: fall back to the SVG bytes so the
            // image still renders (browsers display it fine in an <img>).
            res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
            res.end(svg)
            return
          }
          res.setHeader('Content-Type', 'image/png')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(png)
        } catch {
          next()
        }
      })
    },
  }
}

// The site is served from the svgrid.com custom domain at the root, so the
// default base is "/". Override with SVGRID_SITE_BASE (e.g. "/sv-grid/") if you
// ever publish under a github.io project subpath instead.
const base = process.env.SVGRID_SITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    rollupReplace({
      preventAssignment: true,
      values: {
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    }),
    svelte(),
    blogCardDevPlugin(),
  ],
  resolve: {
    alias: {
      '@demos': path.resolve(repoRoot, 'examples/src/demos'),
      '@docs': path.resolve(repoRoot, 'docs'),
      // Point at the package's source so edits HMR live in dev. Production
      // build still uses the dist/ published artifacts via the package's
      // `exports` map (vite build resolves through node resolution).
      'sv-grid-core': path.resolve(repoRoot, 'packages/sv-grid-community/src/index.ts'),
      // Pro is a workspace dep but pnpm doesn't symlink it into the website's
      // node_modules, so point it at source too (mirrors the community alias).
      'sv-grid-pro': path.resolve(repoRoot, 'packages/sv-grid-pro/src/index.ts'),
      // The Pro xlsx import + export paths dynamically import `jszip`.
      // The website's package.json declares it but pnpm hoists to a
      // private path; map it explicitly so the dev server resolves
      // without `pnpm install` being re-run after the dep was added.
      jszip: path.resolve(repoRoot, 'node_modules/.pnpm/jszip@3.10.1/node_modules/jszip'),
    },
  },
  optimizeDeps: {
    // The package re-imports its own .svelte files; let vite-plugin-svelte
    // handle them on demand rather than pre-bundling.
    exclude: ['sv-grid-core', 'sv-grid-pro'],
  },
  server: { port: 5180, fs: { allow: [repoRoot] } },
})
