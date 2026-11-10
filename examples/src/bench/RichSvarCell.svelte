<script lang="ts">
  /**
   * The rich-cells scenario (rich.ts) for SVAR: its cell API is a component
   * on the column (`column.cell`), given the row and the column. One
   * component for the eight kinds; a column's kind never changes, so the
   * branch is taken once per cell.
   */
  import { avatarOf, fmtDate, tagList, STARS_ON, STARS_OFF } from './rich'

  // Typed loosely to match SVAR's ICellProps: its column id may be a number or unset.
  const { row, column }: { row: Record<string, unknown>; column: { id?: string | number; kind?: string } } = $props()
  const value = $derived(row[String(column.id)])
</script>

{#if column.kind === 'avatar'}
  {@const a = avatarOf(value)}
  <span class="rc-avatar" style="background:{a.color}">{a.initials}</span><span class="rc-name">{value}</span>
{:else if column.kind === 'badge'}<span class="rc-badge rc-{value}">{value}</span>
{:else if column.kind === 'progress'}<span class="rc-progress"><span class="rc-bar" style="width:{value}%"></span></span><span class="rc-pct">{value}%</span>
{:else if column.kind === 'rating'}<span class="rc-stars">{STARS_ON[Number(value) | 0]}<span class="rc-off">{STARS_OFF[Number(value) | 0]}</span></span>
{:else if column.kind === 'check'}<input type="checkbox" class="rc-check" disabled checked={!!value} />
{:else if column.kind === 'date'}<time class="rc-date" datetime={String(value)}>{fmtDate(value)}</time>
{:else if column.kind === 'link'}<a class="rc-link" href="https://{value}/">{value}</a>
{:else}{#each tagList(value) as t, i (i)}<span class="rc-tag">{t}</span>{/each}
{/if}
