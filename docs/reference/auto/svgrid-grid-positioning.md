# `@svgrid/grid` · `positioning.ts`

Auto-generated. Source: `packages\grid\src\positioning.ts`.

### `type Side`

A physical side the floating element is placed on, relative to the reference.

```ts
export type Side = 'top' | 'bottom' | 'left' | 'right'
```

### `type Align`

Cross-axis alignment. `center` is the bare side (e.g. `'bottom'`).

```ts
export type Align = 'start' | 'center' | 'end'
```

### `type Placement`

`'bottom'` = bottom-center; `'bottom-start'` / `'bottom-end'` align the edges.

```ts
export type Placement = Side | `${Side}-start` | `${Side}-end`
```

### `type Rect`

A viewport-relative rectangle (CSS `getBoundingClientRect` shape suffices).

```ts
export type Rect = { x: number; y: number; width: number; height: number }
```

### `type Viewport`

The available viewport (defaults to `window` in the browser).

```ts
export type Viewport = { width: number; height: number }
```

### `type ComputePositionOptions`

Where to put a floating element: its preferred side, offsets, and collision behaviour.

```ts
export type ComputePositionOptions = {
  /** Preferred placement. Default `'bottom-start'`. */
  placement?: Placement
  /** Main-axis gap between reference and floating. Default 6. */
  offset?: number
  /** Viewport edge kept clear on every side. Default 8. */
  padding?: number
  /** Flip to the opposite side when the preferred side overflows. Default true. */
  flip?: boolean
  /** Shift along the cross axis to stay in view (without flipping). Default true. */
  shift?: boolean
  /** Compute `maxWidth`/`maxHeight` for the chosen side. Default true. */
  size?: boolean
  /** When set, compute the arrow offset for an arrow element of this size (px). */
  arrow?: { size: number }
  /** Extra placements to try (after the automatic opposite) before giving up. */
  fallbackPlacements?: Placement[]
  /** Viewport to fit within. Defaults to the window; pure callers pass it. */
  viewport?: Viewport
  /** Floor for the available main-axis size returned by `size`. Default 0. */
  minMainAxis?: number
}
```

### `type ComputePositionResult`

The resolved position, including the side actually used after collision handling.

```ts
export type ComputePositionResult = {
  /** Floating left, in viewport (fixed-position) coordinates. */
  x: number
  /** Floating top, in viewport (fixed-position) coordinates. */
  y: number
  /** The resolved placement after flip. */
  placement: Placement
  /** The resolved side after flip. */
  side: Side
  /** The resolved cross-axis alignment. */
  align: Align
  /** Space available for the floating on the chosen side's main axis (+cross). */
  maxWidth: number
  maxHeight: number
  /**
   * Arrow offset within the floating box: `x` for top/bottom placements, `y` for
   * left/right. Only present when `options.arrow` is set. Clamped so the arrow
   * stays inside the floating (minus padding).
   */
  arrow?: { x?: number; y?: number }
}
```

### `function parsePlacement`

Split a placement into its side + alignment (`center` when no suffix).

```ts
export function parsePlacement(p: Placement): { side: Side; align: Align }
```

### `function computePosition`

Compute the floating position anchored to `reference`, applying flip (opposite
side when the preferred side overflows), shift (cross-axis clamp to stay in
view), size (available max width/height on the chosen side) and an optional
arrow offset. Pure - pass an explicit `viewport` in tests.

```ts
export function computePosition(
  reference: Rect,
  floating: Viewport,
  options: ComputePositionOptions = {},
): ComputePositionResult
```

### `function autoUpdate`

Re-run `update` whenever the anchored position could change: the reference or
floating element resizes, an ancestor scrolls, or the window scrolls/resizes.
Returns a cleanup function. SSR-safe (a no-op without `window`).

```ts
const stop = autoUpdate(triggerEl, panelEl, () => reposition())
// ...later
stop()
```

```ts
export function autoUpdate(reference: Element, floating: HTMLElement, update: () => void): () => void
```
