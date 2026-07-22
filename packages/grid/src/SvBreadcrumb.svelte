<script lang="ts" module>
  export type { BreadcrumbItem } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvBreadcrumb - a navigation trail. Each item is a link (`href`), a button
   * (`onClick`), or plain text; the last item is the current page and is never
   * interactive. Long trails collapse the middle to an expandable ellipsis.
   * Parity: Smart breadcrumb.
   *
   * ```svelte
   * <SvBreadcrumb items={[{label:'Home', href:'/'}, {label:'Orders', href:'/orders'}, {label:'#1024'}]} />
   * ```
   */
  import type { BreadcrumbItem } from './ui-app.types'

  type Props = {
    items: ReadonlyArray<BreadcrumbItem>
    /** Separator between crumbs. Default a chevron. */
    separator?: string
    /** Collapse the middle when there are more than this many crumbs. */
    maxItems?: number
    ariaLabel?: string
  }

  let { items, separator = '/', maxItems, ariaLabel = 'Breadcrumb' }: Props = $props()

  let expanded = $state(false)

  // When collapsed, show the first crumb, an ellipsis, and the last two.
  const collapsed = $derived(!!maxItems && !expanded && items.length > maxItems)
  type Display = { item: BreadcrumbItem; index: number } | 'ellipsis'
  const display = $derived<Display[]>(
    collapsed
      ? [
          { item: items[0]!, index: 0 },
          'ellipsis',
          ...items.slice(-2).map((item, i) => ({ item, index: items.length - 2 + i })),
        ]
      : items.map((item, index) => ({ item, index })),
  )
</script>

<nav class="sv-bc" aria-label={ariaLabel}>
  <ol class="sv-bc__list">
    {#each display as entry, i (entry === 'ellipsis' ? `e${i}` : entry.index)}
      {#if i > 0}<li class="sv-bc__sep" aria-hidden="true">{separator}</li>{/if}
      {#if entry === 'ellipsis'}
        <li>
          <button type="button" class="sv-bc__ellipsis" aria-label="Show collapsed crumbs" onclick={() => (expanded = true)}>&hellip;</button>
        </li>
      {:else}
        {@const isLast = entry.index === items.length - 1}
        <li class="sv-bc__item" class:is-current={isLast}>
          {#if isLast}
            <span aria-current="page">{#if entry.item.icon}<span class="sv-bc__icon" aria-hidden="true">{entry.item.icon}</span>{/if}{entry.item.label}</span>
          {:else if entry.item.href}
            <a class="sv-bc__link" href={entry.item.href}>{#if entry.item.icon}<span class="sv-bc__icon" aria-hidden="true">{entry.item.icon}</span>{/if}{entry.item.label}</a>
          {:else if entry.item.onClick}
            <button type="button" class="sv-bc__link sv-bc__btn" onclick={entry.item.onClick}>{#if entry.item.icon}<span class="sv-bc__icon" aria-hidden="true">{entry.item.icon}</span>{/if}{entry.item.label}</button>
          {:else}
            <span>{#if entry.item.icon}<span class="sv-bc__icon" aria-hidden="true">{entry.item.icon}</span>{/if}{entry.item.label}</span>
          {/if}
        </li>
      {/if}
    {/each}
  </ol>
</nav>

<style>
  .sv-bc__list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; list-style: none; margin: 0; padding: 0; font-size: 13px; }
  .sv-bc__sep { color: var(--sg-muted, #94a3b8); user-select: none; }
  .sv-bc__item { color: var(--sg-muted, #64748b); }
  .sv-bc__item.is-current { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .sv-bc__icon { margin-inline-end: 4px; }
  .sv-bc__link {
    color: var(--sg-muted, #64748b); text-decoration: none; border-radius: 4px;
    display: inline-flex; align-items: center;
  }
  .sv-bc__link:hover { color: var(--sg-accent, #2563eb); text-decoration: underline; }
  .sv-bc__btn { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }
  .sv-bc__ellipsis {
    background: var(--sg-row-hover-bg, #f1f5f9); border: 0; border-radius: 5px; cursor: pointer;
    color: var(--sg-muted, #64748b); padding: 0 7px; height: 20px; line-height: 1; font: inherit;
  }
  .sv-bc__ellipsis:hover { color: var(--sg-fg, #0f172a); }
</style>
