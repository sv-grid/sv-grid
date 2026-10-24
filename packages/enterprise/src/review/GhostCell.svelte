<!--
  A cell with a pending proposal: the proposed value, then what the cell
  holds now, struck through. `own` is what the column's own `cell` returned (a
  component, a snippet, text, or nothing for a plain column).
-->
<script lang="ts">
  import type { Component, Snippet } from 'svelte'

  let { own, before, beforeText, after, empty, title }: {
    own: unknown
    before: unknown
    beforeText: string
    after: string
    /** The text for a blank proposed value, in the review's wording. */
    empty: string
    /** "{source} proposes {value} - reason", built by the wrapper. */
    title: string
  } = $props()

  // The grid's render configs (`renderComponent` / `renderSnippet`) are read by
  // shape: the classes are not part of the public surface.
  type ComponentConfig = { component: Component<any>; props?: Record<string, unknown> }
  type SnippetConfig = { snippet: Snippet<[unknown]>; params?: unknown }
  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
  const ownComponent = $derived(isObj(own) && typeof own.component === 'function' ? (own as ComponentConfig) : null)
  const ownSnippet = $derived(isObj(own) && typeof own.snippet === 'function' ? (own as SnippetConfig) : null)
  const ownText = $derived(typeof own === 'string' || typeof own === 'number' ? String(own) : beforeText)
</script>

<span class="sv-review-ghost" {title}>
  <span class="sv-review-ghost-after">{after || empty}</span>
  {#if before != null && before !== ''}
    <s class="sv-review-ghost-before">
      {#if ownComponent}<ownComponent.component {...ownComponent.props ?? {}} />{:else if ownSnippet}{@render ownSnippet.snippet(ownSnippet.params)}{:else}{ownText}{/if}
    </s>
  {/if}
</span>

<style>
  /* Inline text beside the grid's own icon: a block or flex box here would drop
     to a line of its own. The proposed value comes first and is plain text, so
     the cell's ellipsis cuts its end. The struck value is one box, at most half
     the cell: when it does not fit, the ellipsis takes it whole instead of
     leaving a cut-off fragment, and the cell's title still names it. */
  .sv-review-ghost-before {
    display: inline-block;
    max-width: 50%;
    margin-left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    color: var(--sg-muted, #6b7280);
    text-decoration-thickness: 1px;
  }
  .sv-review-ghost-after {
    color: var(--sg-fg, inherit);
    font-weight: 600;
  }
</style>
