// Prerender the whole dashboard to static HTML at build time. The grids
// hydrate on the client; the shell + headings ship as crawlable HTML, which
// is great for SEO and makes the Vercel deploy a static, edge-cached site.
export const prerender = true
