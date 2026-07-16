<script lang="ts">
  /**
   * Shared chrome for the Data-app Studio demos: a modern header (eyebrow +
   * title + subtitle, with optional top-right `actions`), an optional `toolbar`
   * row, and the body. Importing this pulls in the global `.st-*` theme, so the
   * demos share one contemporary look.
   */
  import './studio-theme.css'
  import type { Snippet } from 'svelte'

  let {
    title,
    subtitle,
    eyebrow = 'Data-app Studio',
    actions,
    toolbar,
    children,
  }: {
    title: string
    subtitle?: string
    eyebrow?: string
    actions?: Snippet
    toolbar?: Snippet
    children: Snippet
  } = $props()
</script>

<div class="st">
  <header class="st__head">
    <div class="st__titles">
      {#if eyebrow}<span class="st__eyebrow">{eyebrow}</span>{/if}
      <h2 class="st__title">{title}</h2>
      {#if subtitle}<p class="st__sub">{@html subtitle}</p>{/if}
    </div>
    {#if actions}<div class="st__actions">{@render actions()}</div>{/if}
  </header>

  {#if toolbar}<div class="st__toolbar">{@render toolbar()}</div>{/if}

  {@render children()}
</div>
