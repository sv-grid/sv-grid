<script lang="ts">
  // Typography primitives - SvTitle / SvText / SvAnchor / SvBlockquote / SvMark / SvList.
  // Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-typography
  import { SvTitle, SvText, SvAnchor, SvBlockquote, SvMark, SvList } from '@svgrid/grid'
</script>

<SvTitle order={1}>Dashboard</SvTitle>
<SvText tone="muted">Last synced 2 minutes ago.</SvText>

<SvText>
  A <SvMark>highlighted</SvMark> phrase and an
  <SvAnchor href="https://svelte.dev" external>external link</SvAnchor>.
</SvText>

<SvBlockquote cite="Ada Lovelace">The Analytical Engine weaves algebraic patterns.</SvBlockquote>

<SvList type="ordered" items={['Install', 'Import', 'Render']} />
