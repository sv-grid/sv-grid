/**
 * mask - a tiny pattern-mask engine shared by SvMaskedInput / SvPhoneInput.
 * Pattern tokens:
 *   #  a digit (0-9)
 *   A  a letter (a-z A-Z)
 *   *  a letter or digit
 * Any other character is a literal that is auto-inserted. Framework-free.
 */

const isDigit = (c: string) => c >= '0' && c <= '9'
const isAlpha = (c: string) => /[a-zA-Z]/.test(c)

function matches(token: string, ch: string): boolean {
  if (token === '#') return isDigit(ch)
  if (token === 'A') return isAlpha(ch)
  if (token === '*') return isDigit(ch) || isAlpha(ch)
  return false
}

const isToken = (c: string) => c === '#' || c === 'A' || c === '*'

/**
 * Apply `pattern` to raw input `value`, inserting literals and dropping chars
 * that don't fit the next token. Returns the formatted string and the count of
 * consumed input characters (useful for caret math).
 */
export function applyMask(value: string, pattern: string): { formatted: string; filled: number } {
  let out = ''
  let vi = 0
  let filled = 0
  for (let pi = 0; pi < pattern.length; pi++) {
    const token = pattern[pi]!
    if (!isToken(token)) {
      // Literal: emit it only once we have (or will have) more input to place.
      out += token
      // Skip a matching literal the user may have typed.
      if (value[vi] === token) vi++
      continue
    }
    // Advance through input until a char fits this token.
    while (vi < value.length && !matches(token, value[vi]!)) vi++
    if (vi >= value.length) break // no more input for this token
    out += value[vi]!
    vi++
    filled++
  }
  // Drop any trailing literals with no following data char.
  return { formatted: trimTrailingLiterals(out), filled }
}

function trimTrailingLiterals(out: string): string {
  // Count how many token-positions are filled; cut the string at the last
  // filled data char plus any literals strictly before the next token.
  let lastData = -1
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!
    if (isDigit(c) || isAlpha(c)) lastData = i
  }
  if (lastData < 0) return ''
  // Keep literals that sit between data chars but trim the tail after last data.
  return out.slice(0, lastData + 1)
}

/** Strip literals, returning only the data characters the user supplied. */
export function unmask(value: string, pattern: string): string {
  let out = ''
  let vi = 0
  for (let pi = 0; pi < pattern.length && vi < value.length; pi++) {
    const token = pattern[pi]!
    if (!isToken(token)) {
      if (value[vi] === token) vi++
      continue
    }
    while (vi < value.length && !matches(token, value[vi]!)) vi++
    if (vi < value.length) { out += value[vi]!; vi++ }
  }
  return out
}

/** True when every token position in the pattern is filled. */
export function isMaskComplete(value: string, pattern: string): boolean {
  const tokenCount = [...pattern].filter(isToken).length
  return unmask(value, pattern).length >= tokenCount
}
