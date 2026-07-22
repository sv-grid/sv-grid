<script lang="ts" module>
  export type { TimelineItem } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvTimeline - a vertical activity / history feed: a connecting line with a
   * marker (colour + optional glyph) per entry, and a title / time / description.
   * Data-driven via `items`, with an optional `item` snippet for custom content.
   * Theme-driven. Parity: Smart timeline.
   *
   * ```svelte
   * <SvTimeline items={[
   *   { title: 'Order placed', time: '09:12', color: '#16a34a' },
   *   { title: 'Shipped', time: '14:40', description: 'Left the warehouse' },
   * ]} />
   * ```
   */
  import type { Snippet } from 'svelte'
  import type { TimelineItem } from './ui-app.types'

  type Props = {
    items: ReadonlyArray<TimelineItem>
    /** Render custom content per entry (receives the item). */
    item?: Snippet<[TimelineItem]>
  }

  let { items, item }: Props = $props()
</script>

<ol class="sv-timeline">
  {#each items as it, i (it.id ?? i)}
    <li class="sv-timeline__item">
      <div class="sv-timeline__rail">
        <span class="sv-timeline__marker" style:--c={it.color}>
          {#if it.icon}<span class="sv-timeline__glyph">{it.icon}</span>{/if}
        </span>
      </div>
      <div class="sv-timeline__content">
        {#if item}
          {@render item(it)}
        {:else}
          <div class="sv-timeline__row">
            <span class="sv-timeline__title">{it.title}</span>
            {#if it.time}<span class="sv-timeline__time">{it.time}</span>{/if}
          </div>
          {#if it.description}<p class="sv-timeline__desc">{it.description}</p>{/if}
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .sv-timeline { list-style: none; margin: 0; padding: 0; color: var(--sg-fg, #0f172a); }
  .sv-timeline__item { display: grid; grid-template-columns: 22px 1fr; gap: 10px; }
  .sv-timeline__rail { display: flex; flex-direction: column; align-items: center; }
  .sv-timeline__marker {
    --c: var(--sg-accent, #2563eb);
    flex: none; width: 14px; height: 14px; margin-top: 2px; border-radius: 50%;
    display: grid; place-items: center; font-size: 8px; color: var(--sg-on-accent, #fff);
    background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent);
  }
  .sv-timeline__glyph { line-height: 1; }
  /* The connecting line: grows to fill the rail between markers. */
  .sv-timeline__item:not(:last-child) .sv-timeline__rail::after {
    content: ''; flex: 1; width: 2px; margin: 3px 0 -2px; background: var(--sg-border, #e2e8f0); border-radius: 1px;
  }
  .sv-timeline__content { padding-bottom: 16px; min-width: 0; }
  .sv-timeline__item:last-child .sv-timeline__content { padding-bottom: 0; }
  .sv-timeline__row { display: flex; align-items: baseline; gap: 10px; }
  .sv-timeline__title { font-size: 13.5px; font-weight: 600; }
  .sv-timeline__time { margin-inline-start: auto; flex: none; font-size: 11.5px; color: var(--sg-muted, #94a3b8); font-variant-numeric: tabular-nums; }
  .sv-timeline__desc { margin: 2px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); line-height: 1.5; }
</style>
