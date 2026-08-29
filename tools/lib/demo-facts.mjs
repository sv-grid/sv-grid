/**
 * Facts a demo's Svelte source states about itself: the pitch in its leading
 * comment, what it imports, which table features it registers, its column
 * shape and the SvGridApi methods it calls. Shared by the prompt sidecars
 * (tools/build-demo-prompts.mjs), the prerendered demo pages and the website's
 * demo route, so all three describe a demo the same way.
 */

/** The leading `/** ... *\/` comment block, one line per comment line. */
export function leadingComment(src) {
  const m = String(src ?? '').match(/\/\*\*\s*([\s\S]*?)\s*\*\//)
  if (!m) return ''
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

/**
 * The pitch as prose: the leading comment without its "<n>. Title" line and
 * the "-----" rule under it (both restate the heading the page already has).
 */
export function pitchFromSource(src) {
  const raw = leadingComment(src)
  if (!raw) return ''
  const lines = raw.split('\n')
  if (/^\s*\d+\.\s/.test(lines[0] ?? '')) lines.shift()
  return lines.filter((l) => !/^\s*-{3,}\s*$/.test(l)).join('\n').trim()
}

/** Module specifiers the demo imports, in source order, deduplicated. */
export function imports(src) {
  return [...String(src ?? '').matchAll(/^\s*import\s+(?:type\s+)?(?:\{[\s\S]*?\}|[^;{]+?)\s+from\s+['"]([^'"]+)['"]/gm)]
    .map((m) => m[1])
    .filter((p, i, a) => a.indexOf(p) === i)
}

/** Feature names passed to `tableFeatures({ ... })`. */
export function featureRegistry(src) {
  const m = String(src ?? '').match(/tableFeatures\(\s*\{\s*([^}]+)\s*\}/)
  if (!m) return []
  return m[1].split(',').map((s) => s.trim().replace(/:\s*.*$/, '')).filter(Boolean)
}

/** The first `columns: [ ... ]` literal, truncated for prompt use. */
export function columnShape(src) {
  const m = String(src ?? '').match(/columns\s*:\s*\[([\s\S]*?)\]/)
  if (!m) return ''
  return m[1].slice(0, 1500).trim()
}

/** `{ field, header }` pairs from the first columns literal the demo declares. */
export function columnFields(src) {
  const text = String(src ?? '')
  const start = text.search(/\bcolumns\b[^=\n]*[=:]\s*\[/)
  if (start === -1) return []
  const block = text.slice(start, start + 6000)
  const out = []
  const re = /field:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(block))) {
    const next = block.slice(m.index + m[0].length).search(/field:\s*['"]/)
    const span = block.slice(m.index, next === -1 ? m.index + 400 : m.index + m[0].length + next)
    const h = span.match(/header:\s*['"]([^'"]*)['"]/)
    out.push({ field: m[1], header: h ? h[1] : '' })
    if (out.length >= 12) break
  }
  return out
}

/** SvGridApi method names the demo calls (`api.foo(` / `api?.foo(`). */
export function apiCalls(src) {
  return [...String(src ?? '').matchAll(/\bapi[.?]\.?([a-zA-Z]+)\(/g)]
    .map((m) => m[1])
    .filter((n) => /^[a-z]/.test(n))
    .filter((p, i, a) => a.indexOf(p) === i)
    .sort()
}

/** Everything above in one object, for pages that list "what this demo uses". */
export function demoFacts(src) {
  return {
    imports: imports(src),
    features: featureRegistry(src),
    columns: columnFields(src),
    api: apiCalls(src),
  }
}
