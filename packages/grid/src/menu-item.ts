import type { Snippet } from 'svelte'

/**
 * A single item in a menu (SvMenu / SvMenuList / SvContextMenu) and the headless
 * `createMenu` core. Kept in a plain `.ts` module so the core can import the type
 * without pulling in the `.svelte` component - which would create a
 * `.svelte.ts` -> `.svelte` -> `.svelte.ts` import cycle that Vite's dev-time
 * import-analysis fails to resolve.
 */
export type MenuItem = {
  /** Item text. Omit + set `separator` for a divider. */
  label?: string
  separator?: boolean
  icon?: Snippet
  /** Right-aligned hint, e.g. a keyboard shortcut. */
  shortcut?: string
  disabled?: boolean
  /** Nested submenu items (renders a flyout). */
  children?: MenuItem[]
  onSelect?: () => void
}
