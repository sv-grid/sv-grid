# SvLoadingOverlay

A cover-a-container loading scrim: a translucent overlay with a centred spinner
that sits on top of any positioned parent while its content loads or saves.

`SvLoadingOverlay` fills its nearest positioned ancestor (`position: absolute;
inset: 0`) with a scrim + [SvSpinner](sv-spinner.md) and an optional label. Drop
it inside a `position: relative` wrapper so the content stays visible (optionally
blurred) underneath while an async action is in flight - a save, a fetch, a
recalculation.

Related: [SvSpinner](sv-spinner.md) · [SvSkeleton](sv-skeleton.md) · [SvResult](sv-result.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvLoadingOverlay` starter into your app:

<div data-docs-add="add loading-overlay"></div>

Prefer to see it first? `npx @svgrid/ui try loading-overlay` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvLoadingOverlay` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvLoadingOverlay } from '@svgrid/grid'
```

## Example

<div data-docs-demo="409-layout-feedback" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvLoadingOverlay } from '@svgrid/grid'
  let loading = $state(false)
</script>

<div style="position: relative">
  <SvLoadingOverlay visible={loading} label="Saving…" />
  <!-- panel content -->
</div>
```

The wrapper **must** be positioned (`relative` / `absolute`) - the overlay pins
itself to that box with `inset: 0`.

## Props

| Prop          | Type                              | Default | Description                                                          |
| ------------- | --------------------------------- | ------- | -------------------------------------------------------------------- |
| `visible`     | `boolean`                         | `false` | Show the overlay. Nothing renders when `false`.                      |
| `label`       | `string`                          | -       | Text under the spinner and the overlay's accessible name.           |
| `spinnerSize` | `sm` \| `md` \| `lg` \| `number`  | `lg`    | Size passed through to the inner [SvSpinner](sv-spinner.md).         |
| `blur`        | `boolean`                         | `false` | Blur the content behind the scrim.                                   |
| `children`    | `Snippet`                         | -       | Custom overlay content in place of the default spinner + label.      |

## Accessibility

- The overlay is `role="status"` with `aria-live="polite"` and an `aria-label`
  (falls back to `"Loading"`), so its appearance is announced without stealing
  focus.
- It does not trap focus. If the underlying content must be non-interactive while
  loading, disable those controls or set `inert` on the wrapper yourself.

## See also

- [SvSpinner](sv-spinner.md) - the inline indicator used inside this overlay.
- [SvSkeleton](sv-skeleton.md) - placeholder shapes for first-load content.
- [SvResult](sv-result.md) - the terminal state once the async action finishes.
