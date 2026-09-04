/**
 * Re-exports Svelte's client API through a module Vite serves.
 *
 * `page.evaluate` runs a bare `import('svelte')` in the browser, where nothing
 * rewrites the bare specifier - Vite only resolves imports inside modules it
 * serves. Importing this file instead gives a profiling spec access to
 * `mount` / `unmount` without loading the whole adapter surface.
 */
export { mount, unmount } from 'svelte'
