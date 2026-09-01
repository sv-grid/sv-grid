export type RouteSeoEntry = {
  title: string
  description: string
  keywords?: string[]
  /** Page-relative, no trailing slash except on the homepage ("/"). */
  path: string
  /** Default true. False keeps the route client-side only. */
  prerender?: boolean
}
export const ROUTE_SEO: Record<string, RouteSeoEntry>
/** `[section, title, description]` tuples, table order, prerendered routes only. */
export function prerenderedRoutes(): [string, string, string][]
