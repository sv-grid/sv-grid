<script lang="ts">
  // SvCarousel - a sliding slideshow with arrows, dots, and autoplay. Your copy, edit freely. Docs: https://svgrid.com/docs/help/ui-components/sv-carousel
  import { SvCarousel } from '@svgrid/grid'

  const imgs = ['/a.jpg', '/b.jpg', '/c.jpg']
</script>

<SvCarousel count={imgs.length} autoplay={4000}>
  {#snippet slide(i)}<img src={imgs[i]} alt="" />{/snippet}
</SvCarousel>
