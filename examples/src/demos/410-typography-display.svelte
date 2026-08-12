<script lang="ts">
  /**
   * Typography + display primitives - SvTitle / SvText / SvAnchor / SvBlockquote /
   * SvMark / SvList for prose, and SvKbd / SvCode / SvAspectRatio /
   * SvVisuallyHidden for the small display bits. All themed from the --sg-* tokens.
   */
  import {
    SvTitle, SvText, SvAnchor, SvBlockquote, SvMark, SvList,
    SvKbd, SvCode, SvAspectRatio, SvVisuallyHidden,
    SvStack, SvGroup, SvCard,
  } from '@svgrid/grid'

  const steps = ['Install the package', 'Import the component', 'Render it in your markup']
</script>

<div class="page">
<SvStack gap={24}>
  <section>
    <SvTitle order={1}>Typography</SvTitle>
    <SvText tone="muted">A consistent type scale and text tones built on the shared tokens.</SvText>
  </section>

  <section>
    <SvStack gap={8}>
      <SvTitle order={2}>Headings decouple size from level</SvTitle>
      <SvTitle order={3} size={5}>An h3 sized like an h5 (semantic, but compact)</SvTitle>
      <SvText>
        Body text with a <SvMark>highlighted</SvMark> phrase, a
        <SvMark tone="success">success</SvMark> tint, and an inline
        <SvAnchor href="https://svelte.dev" external>external link</SvAnchor>.
      </SvText>
      <SvText size="sm" tone="muted" clamp={2}>
        This paragraph is clamped to two lines - a longer description that keeps going
        well past what fits so you can see the ellipsis kick in at the end of the second
        line rather than pushing the layout taller than intended on small cards.
      </SvText>
    </SvStack>
  </section>

  <section>
    <SvTitle order={2}>Blockquote</SvTitle>
    <SvBlockquote cite="Ada Lovelace">
      The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves.
    </SvBlockquote>
  </section>

  <section>
    <SvTitle order={2}>Lists</SvTitle>
    <SvGroup gap={40} align="start">
      <SvList type="ordered" items={steps} />
      <SvList items={['Themed from --sg-* tokens', 'Ordered / unordered / none', 'Custom li snippet supported']} />
    </SvGroup>
  </section>

  <section>
    <SvTitle order={2}>Display bits</SvTitle>
    <SvStack gap={12}>
      <SvGroup gap={10} align="center">
        <SvText size="sm" tone="muted">Open the palette with</SvText>
        <SvKbd keys={['Ctrl', 'K']} />
        <SvText size="sm" tone="muted">or press</SvText>
        <SvKbd>Esc</SvKbd>
        <SvText size="sm" tone="muted">to close.</SvText>
      </SvGroup>

      <SvText>Install with <SvCode>npm i @svgrid/grid</SvCode>, then:</SvText>
      <SvCode block code={`import { SvTitle, SvText } from '@svgrid/grid'

<SvTitle order={1}>Hello</SvTitle>
<SvText tone="muted">Themed for free.</SvText>`} />

      <SvCard>
        <SvAspectRatio ratio={16 / 9}>
          <div class="media">16 : 9 aspect box (no layout shift)</div>
        </SvAspectRatio>
      </SvCard>

      <button class="icon-btn">
        ★<SvVisuallyHidden>Add to favourites</SvVisuallyHidden>
      </button>
    </SvStack>
  </section>
</SvStack>
</div>

<style>
  .page { padding: 24px; max-width: 680px; }
  section { margin: 0; }
  .media {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--sg-accent, #2563eb), color-mix(in srgb, var(--sg-accent, #2563eb) 55%, #000));
    color: #fff; font-size: 13px; font-weight: 600;
  }
  .icon-btn {
    align-self: flex-start;
    width: 34px; height: 34px; font-size: 16px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
</style>
