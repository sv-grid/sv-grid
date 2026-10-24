<!--
  A cell with a pending proposal: the proposed value, then what the cell
  holds now, struck through. `own` is what the column's own `cell` returned (a
  component, a snippet, text, or nothing for a plain column).
-->
<script lang="ts">
  import type { Component, Snippet } from 'svelte'

  let { own, before, beforeText, after, reason, source }: {
    own: unknown
    before: unknown
    beforeText: string
    after: string
    reason?: string
    source: string
  } = $props()

  // The grid's render configs (`renderComponent` / `renderSnippet`) are read by
  // shape: the classes are not part of the public surface.
  type ComponentConfig = { component: Component<any>; props?: Record<string, unknown> }
  type SnippetConfig = { snippet: Snippet<[unknown]>; params?: unknown }
  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object'
  const ownComponent = $derived(isObj(own) && typeof own.component === 'function' ? (own as ComponentConfig) : null)
  const ownSnippet = $derived(isObj(own) && typeof own.snippet === 'function' ? (own as SnippetConfig) : null)
  const ownText = $derived(typeof own === 'string' || typeof own === 'number' ? String(own) : beforeText)
  const title = $derived(`${source} proposes ${after || '(empty)'}${reason ? ` - ${reason}` : ''}`)
</script>

<span class="sv-review-ghost" {title}>
  <span class="sv-review-ghost-after">{after || '(empty)'}</span>
  {#if before != null && before !== ''}
    <s class="sv-review-ghost-before">
      {#if ownComponent}<ownComponent.component {...ownComponent.props ?? {}} />{:else if ownSnippet}{@render ownSnippet.snippet(ownSnippet.params)}{:else}{ownText}{/if}
    </s>
  {/if}
</span>

<style>
  /* Plain inline text, so a narrow cell's own ellipsis cuts the end of it.
     An inline-flex box overflowing a cell is replaced by the ellipsis whole.
     The proposed value comes first: it is the one a narrow cell must show. */
  .sv-review-ghost-before {
    margin-left: 6px;
    color: var(--sg-muted, #6b7280);
    text-decoration-thickness: 1px;
  }
  .sv-review-ghost-after {
    color: var(--sg-fg, inherit);
    font-weight: 600;
  }
</style>
