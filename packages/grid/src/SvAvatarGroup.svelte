<script lang="ts">
  /**
   * SvAvatarGroup - overlapping stacked avatars with a "+N" overflow pill, for
   * "assigned to" / "members" rows. Each entry is a set of SvAvatar props.
   *
   * ```svelte
   * <SvAvatarGroup max={3} avatars={[{ name: 'Ada' }, { name: 'Alan' }, { name: 'Grace' }, { name: 'Ken' }]} />
   * ```
   */
  import SvAvatar from './SvAvatar.svelte'

  type AvatarProps = { name?: string; src?: string; alt?: string; color?: string }
  type Size = 'sm' | 'md' | 'lg' | number

  type Props = {
    avatars: ReadonlyArray<AvatarProps>
    /** Max avatars shown before collapsing to "+N". */
    max?: number
    size?: Size
  }

  let { avatars, max = 4, size = 'md' }: Props = $props()

  const shown = $derived(avatars.slice(0, max))
  const overflow = $derived(Math.max(0, avatars.length - max))
  const px = $derived(typeof size === 'number' ? size : size === 'sm' ? 28 : size === 'lg' ? 48 : 36)
  const overlap = $derived(Math.round(px * 0.28))
</script>

<div class="sv-avgroup" role="group" style:--ov={`${overlap}px`}>
  {#each shown as a, i (i)}
    <span class="sv-avgroup__it" style:z-index={shown.length - i}><SvAvatar {...a} {size} /></span>
  {/each}
  {#if overflow}
    <span class="sv-avgroup__more" style:width={`${px}px`} style:height={`${px}px`} style:font-size={`${Math.round(px * 0.36)}px`}>+{overflow}</span>
  {/if}
</div>

<style>
  .sv-avgroup { display: inline-flex; align-items: center; }
  .sv-avgroup__it { display: inline-flex; margin-inline-start: calc(-1 * var(--ov, 10px)); border-radius: 50%; box-shadow: 0 0 0 2px var(--sg-bg, #fff); }
  .sv-avgroup__it:first-child { margin-inline-start: 0; }
  .sv-avgroup__more {
    display: grid; place-items: center; margin-inline-start: calc(-1 * var(--ov, 10px)); border-radius: 50%;
    background: var(--sg-row-hover-bg, #e2e8f0); color: var(--sg-muted, #64748b); font-weight: 650;
    box-shadow: 0 0 0 2px var(--sg-bg, #fff);
  }
</style>
