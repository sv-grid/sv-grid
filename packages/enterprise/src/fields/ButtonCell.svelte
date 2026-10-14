<script lang="ts">
  /**
   * Button cells. The action is the column's `fieldProps.onClick` when the app
   * set one, then an automation that runs on this button (`<SvBase>` hands the
   * grid `fieldButtons`), otherwise the URL template with `{Field name}` filled in from the
   * row (values URL-encoded); only an http(s) result opens.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { buttonUrl } from './button'

  // `onClick` gets the row's id and the grid's api too, so it can call
  // `openRecord({ api, rowId })`.
  type ButtonClick = { row: unknown; columnId: string; rowId: string; api: unknown }
  let { ctrl, row, column, props }: FieldCellProps<{ label?: string; color?: string; url?: string; onClick?: (ctx: ButtonClick) => void }> = $props()
  const g = $derived(row as { original: Record<string, unknown> })
  const automation = $derived(props.onClick ? null : ((ctrl as { props?: { fieldButtons?: (id: string) => ((row: unknown) => void) | null } })?.props?.fieldButtons?.(column.id) ?? null))
  const href = $derived(props.onClick || automation ? null : buttonUrl(String(props.url ?? ''), g.original, (column.columnDef as { __fieldNames?: Record<string, string> }).__fieldNames))
  const disabled = $derived(!props.onClick && !automation && !href)

  function run(e: MouseEvent) {
    e.stopPropagation()
    if (props.onClick) props.onClick({ row: g.original, columnId: column.id, rowId: (row as { id: string }).id, api: (ctrl as { buildApi?: () => unknown })?.buildApi?.() })
    else if (automation) automation(g.original)
    else if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }
</script>

<button
  type="button"
  class="sv-fbt"
  style:--c={props.color || '#2d7ff9'}
  {disabled}
  title={href ?? undefined}
  onpointerdown={(e) => e.stopPropagation()}
  onclick={run}
>{props.label || 'Open'}</button>

<style>
  .sv-fbt {
    max-width: 100%; height: 24px; padding: 0 10px; border-radius: 6px; font: inherit; font-size: 12px; font-weight: 500;
    border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
    background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--sg-fg, #0f172a);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
  }
  .sv-fbt:hover:not(:disabled) { background: color-mix(in srgb, var(--c) 22%, transparent); }
  .sv-fbt:disabled { opacity: 0.45; cursor: default; }
</style>
