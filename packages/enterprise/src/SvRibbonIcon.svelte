<script lang="ts">
  /**
   * One ribbon icon, by name, at any size.
   *
   * The paths live in `sheet/ribbon-icons.ts` on a 16-unit grid; the SVG
   * scales them, so a large button gets the same drawing at 32px without a
   * second set. Everything is drawn in `currentColor`: the icon is the
   * colour of the text around it, black on a light ribbon and white on a
   * dark one, and nothing in the set carries a colour of its own.
   */
  import { RIBBON_ICONS, type RibbonIconName } from './sheet/ribbon-icons'

  let { name, size = 16 }: { name: RibbonIconName; size?: number } = $props()

  const paths = $derived(RIBBON_ICONS[name] ?? [])
</script>

<svg
  class="sv-ribbon-icon"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.4"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each paths as path, i (i)}
    <path
      d={path.d}
      fill={path.fill ? 'currentColor' : 'none'}
      stroke-width={path.width}
      stroke-dasharray={path.dash}
    />
  {/each}
</svg>

<style>
  .sv-ribbon-icon {
    display: block;
    flex: 0 0 auto;
  }
</style>
