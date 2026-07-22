<script lang="ts">
  /**
   * SvButton - a production action bar block: variants, sizes, icons, loading and
   * a full-width CTA. Copy-paste ready. SvButton exceeds a bare button with
   * variant / loading / icon / block / href baked in.
   */
  import { SvButton } from '@svgrid/grid'

  let saving = $state(false)
  async function save() {
    saving = true
    await new Promise((r) => setTimeout(r, 1200))
    saving = false
  }
</script>

<div class="wrap">
  <header>
    <h2>Button</h2>
    <p>Variants, sizes, icons, loading and links - the primitives for toolbars, forms and CTAs.</p>
  </header>

  <section class="block">
    <h3>Toolbar</h3>
    <div class="bar">
      <SvButton variant="primary" onclick={save} loading={saving}>Save changes</SvButton>
      <SvButton variant="secondary">Preview</SvButton>
      <SvButton variant="outline">Duplicate</SvButton>
      <SvButton variant="ghost">Cancel</SvButton>
      <span class="spacer"></span>
      <SvButton variant="danger">Delete</SvButton>
    </div>
  </section>

  <section class="block">
    <h3>Sizes</h3>
    <div class="bar">
      <SvButton size="sm">Small</SvButton>
      <SvButton size="md">Medium</SvButton>
      <SvButton size="lg">Large</SvButton>
    </div>
  </section>

  <section class="block">
    <h3>With icons</h3>
    <div class="bar">
      <SvButton variant="primary">
        {#snippet icon()}<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>{/snippet}
        New item
      </SvButton>
      <SvButton variant="outline">
        {#snippet icon()}<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>{/snippet}
        Export
      </SvButton>
    </div>
  </section>

  <section class="block narrow">
    <h3>Full-width CTA</h3>
    <SvButton variant="primary" block>Continue to checkout</SvButton>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 20px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .block h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .narrow { max-width: 320px; }
</style>
