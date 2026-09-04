/**
 * The one fenced-code-block parser for docs/**.md.
 *
 * `tools/docs-snippets.test.ts` has scanned fences since it started type-checking
 * doc snippets, and the runnable-example builder needs exactly the same scan
 * (same fences, same `{flag}` syntax). Two copies of a markdown scanner drift -
 * one learns about CRLF or a BOM and the other does not - so both import this.
 *
 * Dependency free, so a fresh clone can run the builder without an install.
 */

/**
 * Fence flags recognised across the toolchain. Kept here so the set is
 * discoverable from one place rather than spread across the consumers.
 *
 *   nocheck      - skip type-checking (prose pseudocode)
 *   skipImport   - wrap in a try/catch dummy export rather than top-level
 *   expect-error - block MUST fail to type-check
 *   runnable     - extract to a real component and render it in the page
 */
export const KNOWN_FLAGS = new Set(['nocheck', 'skipImport', 'expect-error', 'runnable'])

/**
 * Every fenced block in `src`, in document order.
 *
 * `line` is 1-based and points at the first line of code (not the fence), which
 * is what an error message wants. `index` counts blocks within the file and is
 * what gives an extracted snippet a stable id.
 */
export function extractFences(file, src) {
  // Strip a UTF-8 BOM if present - several docs files carry one.
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1)

  const out = []
  const lines = src.split(/\r?\n/)
  let i = 0
  let index = 0
  while (i < lines.length) {
    const m = /^```([a-zA-Z]+)(?:\s+\{([^}]*)\})?\s*$/.exec(lines[i] ?? '')
    if (!m) {
      i += 1
      continue
    }
    const lang = m[1].toLowerCase()
    const flags = new Set((m[2] ?? '').split(/[,\s]+/).filter(Boolean))
    const start = i + 1
    let j = start
    while (j < lines.length && !/^```\s*$/.test(lines[j] ?? '')) j += 1
    out.push({
      file,
      index: index++,
      line: start,
      lang,
      flags,
      code: lines.slice(start, j).join('\n'),
    })
    i = j + 1
  }
  return out
}

/**
 * Shape check for a Svelte block that could be extracted as a component: it has
 * a script AND markup outside it. A `<script>`-only block is a module, and a
 * markup-only block references variables it never declares - neither compiles
 * on its own.
 */
export function isComponentShaped(code) {
  const withoutScript = code.replace(/<script[\s\S]*?<\/script>/g, '')
  return /<script/.test(code) && /<[A-Za-z][A-Za-z0-9]*[\s/>]/.test(withoutScript)
}

/**
 * Stable key for a code block, computed identically by the extractor (Node) and
 * the docs page (browser).
 *
 * This is how a rendered `<pre>` finds its compiled chunk: marked drops the
 * `{runnable}` flag from the emitted `language-svelte` class, so the HTML
 * carries no marker of its own. FNV-1a rather than sha1 so the browser side
 * needs no SubtleCrypto and no async - the builder asserts there are no
 * within-page collisions, which is the only scope the lookup uses.
 *
 * Whitespace is normalised so a CRLF checkout keys the same as an LF one, and
 * so the DOM's textContent (always LF) matches the markdown on disk.
 */
export function blockKey(code) {
  const normalized = code.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()
  let h = 0x811c9dc5
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i)
    // 32-bit FNV-1a prime multiply, kept in range with Math.imul.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

const SCRIPT_RE = /<script[^>]*>([\s\S]*?)<\/script>/

/** A block's `<script>` body, and its markup with the script removed. */
export function splitComponent(code) {
  const m = SCRIPT_RE.exec(code)
  return {
    script: m ? m[1].replace(/^\n/, '').replace(/\s+$/, '') : '',
    markup: code.replace(SCRIPT_RE, '').replace(/^\s*\n/, '').replace(/\s+$/, ''),
  }
}

/** Top-level names a script body binds: imports, declarations, types. */
export function declaredNames(script) {
  const names = new Set()
  for (const m of script.matchAll(/^\s*import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/gm)) {
    const clause = m[1]
    for (const n of clause.matchAll(/\b([A-Za-z_$][\w$]*)\b(?!\s*:)/g)) {
      if (!['type', 'as', 'import', 'from'].includes(n[1])) names.add(n[1])
    }
    // `import { a as b }` binds b, which the loop above already caught.
  }
  for (const m of script.matchAll(
    /^\s*(?:export\s+)?(?:let|const|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(m[1])
  }
  return names
}

/**
 * Merge a page preamble into a snippet.
 *
 * Doc blocks are excerpts: they say `<SvGrid {data} {columns} sortable />` and
 * leave `data`, `columns` and even the import to the surrounding page. A
 * `{preamble}` block gives the page one place to declare that shared setup, and
 * this splices it in so the extracted component stands alone.
 *
 * Preamble statements whose binding the snippet re-declares are dropped, so a
 * snippet that defines its own `columns` wins over the page default rather than
 * colliding with it.
 */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NAMED_IMPORT_RE = /^[ \t]*import\s+(type\s+)?\{([^}]*)\}\s+from\s+(['"])([^'"]+)\3[ \t]*;?[ \t]*$/gm

/**
 * Split a script into its named-import statements and everything else.
 *
 * Imports have to merge at the SPECIFIER level, not the statement level: a
 * preamble importing `{ SvCalendar, SvTimePicker }` next to a snippet importing
 * `{ SvCalendar }` is a duplicate-identifier error, and that silently broke
 * previously-runnable blocks the first time preambles landed.
 */
function splitImports(script) {
  const modules = new Map()
  const rest = script.replace(NAMED_IMPORT_RE, (_all, typeOnly, clause, _q, mod) => {
    const set = modules.get(mod) ?? new Map()
    for (const raw of clause.split(',')) {
      const spec = raw.trim()
      if (!spec) continue
      const isType = Boolean(typeOnly) || /^type\s+/.test(spec)
      const name = spec.replace(/^type\s+/, '')
      // A value import wins over a type-only one for the same name.
      if (!set.has(name) || !isType) set.set(name, isType)
    }
    modules.set(mod, set)
    return ''
  })
  return { modules, rest }
}

function renderImports(modules) {
  const out = []
  for (const [mod, names] of modules) {
    const specs = [...names].map(([n, isType]) => (isType ? `type ${n}` : n))
    out.push(`  import { ${specs.join(', ')} } from '${mod}'`)
  }
  return out.join('\n')
}

export function mergePreamble(preambleScript, snippetCode) {
  if (!preambleScript) return snippetCode
  const { script, markup } = splitComponent(snippetCode)
  const own = declaredNames(script)

  const pre = splitImports(preambleScript)
  const snip = splitImports(script)

  // Union the imports, snippet last so its type/value choice wins.
  const modules = new Map()
  for (const [mod, names] of [...pre.modules, ...snip.modules]) {
    const set = modules.get(mod) ?? new Map()
    for (const [n, isType] of names) if (!set.has(n) || !isType) set.set(n, isType)
    modules.set(mod, set)
  }

  // Statement-level split for the non-import body: blank-line separated chunks,
  // which is how these scripts are written and keeps multi-line declarations
  // intact.
  const chunks = pre.rest
    .split(/\n(?=\s*(?:export|let|const|var|function|class|type|interface|enum)\b)/)
    .filter((c) => c.trim())
    .map((code) => ({ code: code.replace(/\s+$/, ''), binds: declaredNames(code) }))

  // A preamble declaration the snippet re-declares is dropped, so a block that
  // defines its own `columns` overrides the page default.
  //
  // The drop has to cascade. A page preamble declaring `type Person` and
  // `const people: Person[]`, merged into a snippet that declares its OWN
  // narrower `Person`, must lose `people` as well - keeping it leaves a value
  // typed against a shape it no longer matches, which is a type error the
  // reader never wrote. Repeat until nothing more falls out.
  const dropped = new Set([...own].filter((n) => chunks.some((c) => c.binds.has(n))))
  for (let changed = true; changed; ) {
    changed = false
    for (const chunk of chunks) {
      if (chunk.gone) continue
      if ([...chunk.binds].some((n) => dropped.has(n))) {
        chunk.gone = true
        changed = true
        continue
      }
      // References a dropped name without redeclaring it: it cannot stand.
      const refs = new RegExp(`\\b(${[...dropped].map(escapeRe).join('|')})\\b`)
      if (dropped.size && refs.test(chunk.code)) {
        chunk.gone = true
        for (const n of chunk.binds) dropped.add(n)
        changed = true
      }
    }
  }

  const kept = chunks.filter((c) => !c.gone).map((c) => c.code)

  const body = [renderImports(modules), kept.join('\n').trim(), snip.rest.trim()]
    .filter(Boolean)
    .join('\n\n')
  return `<script lang="ts">\n${body}\n</script>\n\n${markup}\n`
}
