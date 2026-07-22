<script lang="ts">
  /**
   * SvRichText - a lightweight WYSIWYG editor (bold/italic/underline/strike,
   * headings, lists, quote, code, align, link) over a contentEditable region,
   * emitting HTML. Bindable value; toolbar is configurable. Parity: Smart editor.
   */
  import { SvRichText } from '@svgrid/grid'

  let html = $state(
    '<h2>Release notes</h2><p>This release adds <b>rich text</b>, <i>recurrence</i> and a <a href="#">command palette</a>.</p><ul><li>Faster rendering</li><li>New editors</li></ul><blockquote>Ship early, ship often.</blockquote>',
  )
  let notes = $state('')
</script>

<div class="wrap">
  <header>
    <h2>Rich text editor</h2>
    <p><code>SvRichText</code> emits HTML you can store or render. The toolbar formats the selection; <code>bind:value</code> keeps your state in sync.</p>
  </header>

  <div class="cols">
    <div>
      <div class="lbl">Editor</div>
      <SvRichText bind:value={html} placeholder="Write something…" minHeight="220px" />
    </div>
    <div>
      <div class="lbl">Emitted HTML</div>
      <pre class="out">{html}</pre>
    </div>
  </div>

  <div class="mini">
    <div class="lbl">Compact toolbar (custom tools)</div>
    <SvRichText bind:value={notes} placeholder="A quick note…" minHeight="90px" tools={['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'link', 'clear']} />
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 960px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; }
  header code, .lbl code { background: var(--sg-row-hover-bg, #f1f5f9); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  .lbl { font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); margin-bottom: 6px; }
  .out {
    margin: 0; height: 264px; overflow: auto; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word;
    background: var(--sg-row-hover-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0);
    font: 12px/1.6 ui-monospace, "SF Mono", Menlo, monospace; color: var(--sg-fg, #334155);
  }
  .mini { max-width: 560px; }
</style>
