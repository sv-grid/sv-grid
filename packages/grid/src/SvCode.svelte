<script lang="ts">
  /**
   * SvCode - monospace code. Inline by default; set `block` for a padded,
   * horizontally-scrolling code block. Pass `code` as a string or use the
   * `children` snippet. No syntax highlighting (bring your own).
   *
   * <SvCode>npm i @svgrid/grid</SvCode>
   * <SvCode block code={snippet} />
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Render as a padded block instead of inline. */
    block?: boolean
    /** Code as a string (skip the snippet). */
    code?: string
    children?: Snippet
  }

  let { block = false, code, children }: Props = $props()
</script>

{#if block}
  <pre class="sv-code sv-code--block"><code>{#if code != null}{code}{:else}{@render children?.()}{/if}</code></pre>
{:else}
  <code class="sv-code sv-code--inline">{#if code != null}{code}{:else}{@render children?.()}{/if}</code>
{/if}

<style>
  .sv-code {
    font-family: var(--sg-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.9em;
    color: var(--sg-fg, #0f172a);
  }
  .sv-code--inline {
    padding: 1px 5px;
    background: var(--sg-muted-bg, color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)));
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 4px;
    white-space: nowrap;
  }
  .sv-code--block {
    margin: 0;
    padding: 12px 14px;
    background: var(--sg-muted-bg, color-mix(in srgb, var(--sg-fg, #0f172a) 7%, var(--sg-bg, #fff)));
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow-x: auto;
    line-height: 1.55;
  }
  .sv-code--block code { font-size: 13px; white-space: pre; }
</style>
