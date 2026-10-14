/**
 * A list of names as one line of text, the way a copy writes link and user
 * cells: "Northwind, Acme". A name with a comma or a double quote is quoted
 * CSV style ("Acme, Inc.", inner quotes doubled), so a paste splits it back
 * into the same names.
 */

/** One name, quoted when it holds a comma or a double quote. */
export const quoteName = (name: string): string => (/[",]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name)

/** Names joined with ", ", each quoted when it has to be. */
export const joinNames = (names: ReadonlyArray<string>): string => names.map(quoteName).join(', ')

/**
 * The names in a comma-separated line, trimmed, empty parts left out. A part
 * that starts with a double quote runs to the closing quote, commas included,
 * and `""` inside it is one quote. An unclosed quote runs to the end.
 */
export function splitNames(text: string): string[] {
  const out: string[] = []
  const n = text.length
  let i = 0
  while (i <= n) {
    while (i < n && /\s/.test(text[i]!)) i += 1
    let part = ''
    if (text[i] === '"') {
      i += 1
      while (i < n) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            part += '"'
            i += 2
            continue
          }
          i += 1
          break
        }
        part += text[i]
        i += 1
      }
    }
    // Up to the next comma: a plain part, or what follows a closing quote.
    const comma = text.indexOf(',', i)
    const end = comma < 0 ? n : comma
    part = (part + text.slice(i, end)).trim()
    if (part) out.push(part)
    i = end + 1
  }
  return out
}
