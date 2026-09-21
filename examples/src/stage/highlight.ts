/**
 * A small tokenizer for the editor scene: enough colour for Svelte, TypeScript
 * and shell text to read as code on a video, nothing more. Returns HTML.
 */
const KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'var', 'type', 'interface', 'function', 'return',
  'async', 'await', 'new', 'if', 'else', 'for', 'of', 'in', 'true', 'false', 'null', 'default',
])

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const span = (cls: string, s: string) => `<span class="tk-${cls}">${esc(s)}</span>`

const RULES: Array<[RegExp, string]> = [
  [/^<!--[\s\S]*?-->/, 'comment'],
  [/^\/\/[^\n]*/, 'comment'],
  [/^\/\*[\s\S]*?\*\//, 'comment'],
  [/^(['"`])(?:\\.|(?!\1)[^\\\n])*\1/, 'string'],
  [/^<\/?[A-Za-z][\w:.-]*/, 'tag'],
  [/^\/?>/, 'tag'],
  [/^[A-Za-z_$][\w$]*(?==)/, 'attr'],
  [/^\{[^}\n]*\}/, 'expr'],
  [/^\b\d+(?:\.\d+)?\b/, 'number'],
  [/^[A-Za-z_$][\w$]*/, 'ident'],
  [/^\s+/, 'ws'],
  [/^[\s\S]/, 'punct'],
]

export function highlight(code: string): string {
  let out = ''
  let rest = code
  while (rest.length) {
    let matched = false
    for (const [re, cls] of RULES) {
      const m = rest.match(re)
      if (!m) continue
      const text = m[0]
      if (cls === 'ws' || cls === 'punct') out += esc(text)
      else if (cls === 'ident') out += KEYWORDS.has(text) ? span('kw', text) : /^[A-Z]/.test(text) ? span('type', text) : esc(text)
      else if (cls === 'expr') out += esc('{') + highlight(text.slice(1, -1)) + esc('}')
      else out += span(cls, text)
      rest = rest.slice(text.length)
      matched = true
      break
    }
    if (!matched) {
      out += esc(rest[0]!)
      rest = rest.slice(1)
    }
  }
  return out
}
