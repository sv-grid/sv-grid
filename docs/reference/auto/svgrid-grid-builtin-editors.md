# `@svgrid/grid` · `builtin-editors.ts`

Auto-generated. Source: `packages\grid\src\builtin-editors.ts`.

### `function registerBuiltinEditors`

Register the config-free UI-kit editors (`otp`, `duration`) as grid cell
editors. Idempotent. Returns the list of type names it registered.

```ts
export function registerBuiltinEditors(): string[] {
  registerCellEditor('otp', {
    component: SvOtpInput,
    autoOpen: false,
    props: (ctx) => ({
      value: (ctx.value ?? '') as string,
      autofocus: true,
      onChange: (v: string) => ctx.onChange(v),
      // The code is complete -> commit + stop editing.
      onComplete: (v: string) => ctx.onCommit(v),
    }),
  })
  registerCellEditor('duration', {
    component: SvDurationInput,
    props: (ctx) => ({
      value: (ctx.value ?? null) as number | null,
      autofocus: true,
      onChange: (v: number | null) => ctx.onChange(v),
      onCommit: (v: number | null) => ctx.onCommit(v),
      onCancel: () => ctx.onCancel(),
    }),
  })
  return ['otp', 'duration']
}
```
