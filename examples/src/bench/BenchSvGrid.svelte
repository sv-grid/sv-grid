<script lang="ts">
  /**
   * The sv-grid side of the comparison harness.
   *
   * Deliberately minimal: no toolbar, no theming, no features beyond sorting
   * and column filtering, so what is measured is the grid and not a demo built
   * around it.
   *
   * Sorting and filtering go through the public imperative API (`api.setSort`,
   * `api.setFilter`) rather than props, because there are no controlled
   * `sorting` / `columnFilters` props - only `initialSorting`, which applies
   * once at mount. Every adapter has to be drivable the same way from plain
   * TypeScript, so the harness holds a handle and calls into it.
   *
   * `showRowSelection={false}`: the other grids here draw the nine harness
   * columns and nothing else, and sv-grid's default checkbox column is a
   * tenth, sticky one. It was measured with it until 2026-10-08, which made
   * sv-grid render more than the grids it was compared with.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { avatarOf, fmtDate, tagList, STARS_ON, STARS_OFF, RICH_WIDTH, type RichKind } from './rich'

  type Row = Record<string, unknown>
  type Features = ReturnType<typeof tableFeatures>

  type Props = {
    rows: Row[]
    columns: Array<{ field: string; header: string; type: 'text' | 'number'; kind?: RichKind }>
    rowHeight: number
    handle: {
      setSort?: (field: string, desc: boolean) => void
      setFilter?: (field: string, value: string) => void
      scroller?: () => HTMLElement | null
      setRows?: (rows: Array<Record<string, unknown>>) => void
    }
  }
  const { rows, columns, rowHeight, handle }: Props = $props()

  // The tick path: a new array reference per update, held in $state.raw so
  // the grid sees one reactive write and no proxy over 100k rows.
  let data = $state.raw<Array<Record<string, unknown>>>(rows)
  handle.setRows = (next) => (data = next)

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // The rich-cells scenario (rich.ts): a column with a `kind` draws through
  // the documented cell API, renderSnippet, with the snippet below; the
  // scenario's columns are RICH_WIDTH wide, the main suite's 140.
  const anyRich = columns.some((c) => c.kind)
  const snippetFor = (kind: RichKind) =>
    kind === 'avatar' ? avatarCell : kind === 'badge' ? badgeCell : kind === 'progress' ? progressCell
    : kind === 'rating' ? ratingCell : kind === 'check' ? checkCell : kind === 'date' ? dateCell
    : kind === 'link' ? linkCell : tagsCell
  const cols: ColumnDef<Features, Row>[] = columns.map((c) => {
    const snip = c.kind ? snippetFor(c.kind) : null
    return {
      field: c.field,
      header: c.header,
      width: anyRich ? RICH_WIDTH : 140,
      editorType: c.type === 'number' ? 'number' : undefined,
      ...(snip ? { align: 'left' as const, cell: (ctx: { getValue: () => unknown }) => renderSnippet(snip, { value: ctx.getValue() }) } : {}),
    }
  })

  let rootEl = $state<HTMLElement | null>(null)
  let api: SvGridApi<Features, Row> | null = null

  handle.setSort = (field, desc) => api?.setSort(field, desc ? 'desc' : 'asc')
  handle.setFilter = (field, value) =>
    api?.setFilter(field, value ? { operator: 'contains', value } : null)
  // The grid's body scrolls in .sv-grid-container (both axes). This used to
  // look for .sv-grid-scroll / .sv-grid-body-wrap, neither of which the grid
  // renders, so the harness's scroll step never moved sv-grid at all.
  handle.scroller = () => rootEl?.querySelector<HTMLElement>('.sv-grid-container') ?? null
</script>

{#snippet avatarCell(p: { value: unknown })}
  {@const a = avatarOf(p.value)}
  <span class="rc-avatar" style="background:{a.color}">{a.initials}</span><span class="rc-name">{p.value}</span>
{/snippet}
{#snippet badgeCell(p: { value: unknown })}<span class="rc-badge rc-{p.value}">{p.value}</span>{/snippet}
{#snippet progressCell(p: { value: unknown })}<span class="rc-progress"><span class="rc-bar" style="width:{p.value}%"></span></span><span class="rc-pct">{p.value}%</span>{/snippet}
{#snippet ratingCell(p: { value: unknown })}<span class="rc-stars">{STARS_ON[Number(p.value) | 0]}<span class="rc-off">{STARS_OFF[Number(p.value) | 0]}</span></span>{/snippet}
{#snippet checkCell(p: { value: unknown })}<input type="checkbox" class="rc-check" disabled checked={!!p.value} />{/snippet}
{#snippet dateCell(p: { value: unknown })}<time class="rc-date" datetime={String(p.value)}>{fmtDate(p.value)}</time>{/snippet}
{#snippet linkCell(p: { value: unknown })}<a class="rc-link" href="https://{p.value}/">{p.value}</a>{/snippet}
{#snippet tagsCell(p: { value: unknown })}{#each tagList(p.value) as t, i (i)}<span class="rc-tag">{t}</span>{/each}{/snippet}

<div bind:this={rootEl} style="height:100%">
  <SvGrid
    data={data}
    columns={cols}
    {features}
    rowHeight={rowHeight}
    showPagination={false}
    showRowSelection={false}
    virtualization={true}
    columnVirtualization={true}
    containerHeight="100%"
    onApiReady={(a: SvGridApi<Features, Row>) => (api = a)}
  />
</div>
