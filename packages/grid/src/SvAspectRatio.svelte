<script lang="ts">
  /**
   * SvAspectRatio - hold a fixed width:height ratio for its content (media,
   * embeds, maps, skeletons) so it never causes layout shift. The child fills
   * the box.
   *
   * <SvAspectRatio ratio={16 / 9}><img src={src} alt="" /></SvAspectRatio>
   */
  import type { Snippet } from 'svelte'

  type Props = {
    /** Width / height ratio (e.g. `16 / 9`, `1`, `4 / 3`). */
    ratio?: number
    children?: Snippet
  }

  let { ratio = 16 / 9, children }: Props = $props()
</script>

<div class="sv-aspect" style:aspect-ratio={ratio}>
  {@render children?.()}
</div>

<style>
  .sv-aspect {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  /* Make the single child fill the ratio box by default. */
  .sv-aspect > :global(*) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
