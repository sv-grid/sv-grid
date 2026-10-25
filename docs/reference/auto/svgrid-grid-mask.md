# `@svgrid/grid` · `datetime/mask.ts`

Auto-generated. Source: `packages\grid\src\datetime\mask.ts`.

### `function applyMask`

Apply `pattern` to raw input `value`, inserting literals and dropping chars
that don't fit the next token. Returns the formatted string and the count of
consumed input characters (useful for caret math).

```ts
export function applyMask(value: string, pattern: string): { formatted: string; filled: number }
```

### `function unmask`

Strip literals, returning only the data characters the user supplied.

```ts
export function unmask(value: string, pattern: string): string
```

### `function isMaskComplete`

True when every token position in the pattern is filled.

```ts
export function isMaskComplete(value: string, pattern: string): boolean
```
