/**
 * A page block keeps its headless core in `<script lang="ts" module>`: an
 * exported create<Name>() function with the state, validation and actions,
 * and no markup. `npx @svgrid/ui add <block> --headless` writes only that
 * core, as `<block>.svelte.ts`, for people who render their own markup.
 */

const MODULE_SCRIPT = /<script\b(?=[^>]*\bmodule\b)[^>]*>([\s\S]*?)<\/script>/

/** The module script's body, or null when the file has none. */
export function moduleScript(source) {
  const m = MODULE_SCRIPT.exec(source)
  return m ? m[1] : null
}

/** Remove the common leading indentation (the script's 2-space indent). */
function dedent(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

/**
 * The `.svelte.ts` text for a block's headless core, or null when the block
 * has no module script. `fileName` is the styled file the core came from.
 */
export function headlessCore(source, fileName) {
  const body = moduleScript(source)
  if (body == null) return null
  return (
    `// Headless core of ${fileName}, written by \`npx @svgrid/ui add --headless\`.\n` +
    `// Import it from './${fileName.replace(/\.svelte$/, '.svelte.js')}' and render your own markup.\n` +
    dedent(body) + '\n'
  )
}
