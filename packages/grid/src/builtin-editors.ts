/**
 * builtin-editors - opt-in registration of the configuration-free UI-kit editors
 * as grid cell editors, so a column can use `editorType: 'otp'` or
 * `editorType: 'duration'` out of the box. Call `registerBuiltinEditors()` once
 * near your app root.
 *
 * It is opt-in (rather than automatic) so the editor components tree-shake away
 * when you don't use them. Option / structured editors (SvMultiSelect,
 * SvTreeSelect, SvGridSelect) need their `options` / `nodes` / `columns`, so
 * register those yourself with a props mapping:
 *
 * ```ts
 * import { registerCellEditor, SvMultiSelect } from '@svgrid/grid'
 * registerCellEditor('tags', {
 *   component: SvMultiSelect,
 *   props: (ctx) => ({
 *     options: TAG_OPTIONS,
 *     value: ctx.value,
 *     onChange: ctx.onChange,        // update the in-progress value
 *     onCommit: () => ctx.onCommit(),// e.g. the panel's Done button
 *   }),
 * })
 * ```
 */
import { registerCellEditor } from './editor-registry'
import SvOtpInput from './SvOtpInput.svelte'
import SvDurationInput from './SvDurationInput.svelte'
import SvRichText from './SvRichText.svelte'
import { sanitizeHtml } from './sanitize-html'

/**
 * Register the config-free UI-kit editors (`otp`, `duration`, `richtext`) as
 * grid cell editors. Idempotent. Returns the list of type names it registered.
 */
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
  // Rich text carries a toolbar, so give the column a taller row (or edit it
  // from a detail panel) - it does not fit a default single-line row.
  //
  // Both the value handed to the editor and the value coming back are
  // sanitized. The stored string is the one SvRichCell later paints, so
  // cleaning it on the way in means a pasted payload never reaches row data.
  registerCellEditor('richtext', {
    component: SvRichText,
    props: (ctx) => ({
      value: sanitizeHtml((ctx.value ?? '') as string),
      autofocus: true,
      onChange: (html: string) => ctx.onChange(sanitizeHtml(html)),
    }),
  })
  return ['otp', 'duration', 'richtext']
}
