/**
 * What answers on a port, in one word on stdout. playwright.config.ts runs
 * this synchronously (as a child process, since a config module cannot
 * await) before deciding which port the website server lives on:
 *
 *   free    nothing listens there
 *   ok      the site is served under /sv-grid/, the base the specs expect
 *   other   something answers but not that: usually a dev server started by
 *           hand from website/ (`npm run dev`), which serves the site at "/"
 *
 * The tell is Vite's own client script tag, which carries the base the
 * server was started with (`/sv-grid/@vite/client` versus `/@vite/client`).
 * A status code cannot tell the two apart: a dev server returns index.html
 * for any path it does not know, so the wrong server passes Playwright's
 * readiness check and then every path-routed spec lands on "Page not found".
 */
const port = Number(process.argv[2])
try {
  const res = await fetch(`http://localhost:${port}/sv-grid/`, { signal: AbortSignal.timeout(3000) })
  const html = await res.text()
  process.stdout.write(html.includes('/sv-grid/@vite/client') ? 'ok' : 'other')
} catch {
  process.stdout.write('free')
}
