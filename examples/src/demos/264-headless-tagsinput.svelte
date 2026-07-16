<script lang="ts">
  /**
   * Headless tags input - <SvTagsInput> is one styled renderer over the
   * `createTagsInput` core: draft text, add on Enter/comma, remove last on
   * Backspace, per-chip remove, exposed as prop-getters you spread onto YOUR OWN
   * markup. The same core drives the styled component AND a custom chip render,
   * both bound to one value.
   */
  import { SvTagsInput, createTagsInput } from '@svgrid/grid'

  let value = $state<string[]>(['design', 'svelte'])

  const ti = createTagsInput({
    value: () => value,
    onChange: (t) => (value = t),
  })
</script>

<div class="wrap">
  <header>
    <h2>Tags input - headless</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createTagsInput</code>
      drives both renders below; the draft, add/remove and keyboard come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvTagsInput&gt;</code></h3>
      <SvTagsInput {value} ariaLabel="Tags" onChange={(t) => (value = t)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="box" {...ti.rootProps()}>
        {#each ti.tags as tag, i (tag + i)}
          <span class="chip" {...ti.tagProps(i)}>
            {tag}
            <button class="x" {...ti.removeProps(i)}>&times;</button>
          </span>
        {/each}
        <input class="entry" placeholder={ti.tags.length ? '' : 'Add tag…'} {...ti.inputProps()} />
      </div>
      <p class="hint">Type + Enter or comma to add, Backspace on an empty field removes the last - all from <code>createTagsInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value.length}
      <div class="tags">{#each value as v (v)}<span class="tag">{v}</span>{/each}</div>
    {:else}
      <p class="empty">No tags</p>
    {/if}
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom tags render - nothing shared with SvTagsInput but the core. */
  .box {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 300px; min-height: 42px; padding: 6px 8px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; background: var(--sg-input-bg, #fff);
  }
  .box:focus-within { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 6px 5px 12px; border-radius: 999px;
    font-size: 12.5px; font-weight: 600; background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff);
  }
  .x { background: rgba(255,255,255,0.25); border: 0; color: inherit; cursor: pointer; width: 18px; height: 18px; border-radius: 50%; font-size: 13px; line-height: 1; }
  .entry { flex: 1; min-width: 90px; border: 0; background: none; outline: none; color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; height: 26px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
