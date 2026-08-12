<script lang="ts">
  /**
   * SvHoverCard - a rich preview card that opens when the pointer rests on its
   * anchor (a user chip, a link) and closes shortly after it leaves. Built on the
   * shared positioning engine via SvPopover, so it takes any `placement`, flips
   * and shifts to stay in view, and the card itself is hoverable (you can move the
   * pointer onto it). For keyboard/touch users, prefer SvPopover with a click
   * trigger - a hover card is a pointer affordance.
   *
   * ```svelte
   * <SvHoverCard>
   *   {#snippet anchor()}<a href="/u/ada">@ada</a>{/snippet}
   *   <strong>Ada Lovelace</strong>
   *   <p>Analyst, first programmer.</p>
   * </SvHoverCard>
   * ```
   */
  import type { Snippet } from 'svelte'
  import SvPopover from './SvPopover.svelte'
  import type { Placement } from './positioning'

  type Props = {
    /** Controlled open state (bindable). */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Preferred placement; flips when there is no room. Default `bottom-start`. */
    placement?: Placement
    /** Delay (ms) before the card opens on hover. Default 250. */
    openDelay?: number
    /** Delay (ms) before it closes after the pointer leaves. Default 180. */
    closeDelay?: number
    /** Show a pointer arrow. Default false (cards usually read cleaner without). */
    arrow?: boolean
    /** Force a minimum card width. */
    minWidth?: number
    ariaLabel?: string
    /** The element the card previews. */
    anchor?: Snippet
    /** Card content. */
    children?: Snippet
  }

  let {
    open = $bindable(false),
    onOpenChange,
    placement = 'bottom-start',
    openDelay = 250,
    closeDelay = 180,
    arrow = false,
    minWidth = 240,
    ariaLabel,
    anchor,
    children,
  }: Props = $props()
</script>

<SvPopover
  bind:open
  {onOpenChange}
  trigger="hover"
  {placement}
  {openDelay}
  {closeDelay}
  {arrow}
  {minWidth}
  {ariaLabel}
  {anchor}
>
  {@render children?.()}
</SvPopover>
