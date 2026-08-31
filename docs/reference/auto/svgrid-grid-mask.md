# `@svgrid/grid` · `datetime/mask.ts`

Auto-generated. Source: `packages\grid\src\datetime\mask.ts`.

### `function applyMask`

Apply `pattern` to raw input `value`, inserting literals and dropping chars
that don't fit the next token. Returns the formatted string and the count of
consumed input characters (useful for caret math).

```ts
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
```

### `function unmask`

Strip literals, returning only the data characters the user supplied. */

```ts
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
```

### `function isMaskComplete`

True when every token position in the pattern is filled. */

```ts
export function isMaskComplete(value: string, pattern: string): boolean {
  const tokenCount = [...pattern].filter(isToken).length
  return unmask(value, pattern).length >= tokenCount
}
```
