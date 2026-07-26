<script lang="ts">
  /**
   * SvCarousel - a slideshow: a sliding track with prev/next arrows, dot
   * indicators, optional autoplay (pauses on hover/focus) and swipe. Slides are
   * rendered by the `slide` snippet (index in, your content out). Parity: Smart
   * carousel.
   *
   * ```svelte
   * <SvCarousel count={imgs.length} autoplay={4000}>
   *   {#snippet slide(i)}<img src={imgs[i]} alt="" />{/snippet}
   * </SvCarousel>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { type EditorDir } from './editor-contract'

  type Props = {
    count: number
    slide?: Snippet<[number]>
    /** Active slide index (bindable). */
    current?: number
    /** Autoplay interval in ms; 0 = off. */
    autoplay?: number
    loop?: boolean
    arrows?: boolean
    dots?: boolean
    ariaLabel?: string
    /** Text direction (rtl mirrors the prev/next arrows + slide direction). */
    dir?: EditorDir
  }

  let {
    count,
    slide,
    current = $bindable(0),
    autoplay = 0,
    loop = true,
    arrows = true,
    dots = true,
    ariaLabel = 'Carousel',
    dir,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  const rtl = $derived(resolvedDir === 'rtl')

  function go(i: number) {
    if (count === 0) return
    current = loop ? (i + count) % count : Math.max(0, Math.min(i, count - 1))
  }
  const next = () => go(current + 1)
  const prev = () => go(current - 1)

  // Autoplay, paused while hovered/focused, or stopped via the persistent
  // play/pause toggle (WCAG 2.2.2: auto-advancing content needs a way to stop
  // it that doesn't depend on hover/focus).
  let paused = $state(false)
  let userPaused = $state(false)
  $effect(() => {
    if (!autoplay || paused || userPaused || count < 2) return
    const t = setInterval(next, autoplay)
    return () => clearInterval(t)
  })

  // Swipe.
  let dragging = $state(false)
  let startX = 0
  let dx = $state(0)
  function down(e: PointerEvent) {
    dragging = true
    startX = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function move(e: PointerEvent) { if (dragging) dx = e.clientX - startX }
  function up() {
    if (!dragging) return
    dragging = false
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev())
    dx = 0
  }
</script>

<div
  class="sv-carousel"
  role="group"
  aria-roledescription="carousel"
  aria-label={ariaLabel}
  onpointerenter={() => (paused = true)}
  onpointerleave={() => (paused = false)}
  onfocusin={() => (paused = true)}
  onfocusout={() => (paused = false)}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sv-carousel__viewport" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <div class="sv-carousel__track" class:is-dragging={dragging} style:transform={`translateX(calc(${(rtl ? current : -current) * 100}% + ${dx}px))`}>
      {#each Array(count) as _, i (i)}
        <div class="sv-carousel__slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== current} inert={i !== current}>
          {@render slide?.(i)}
        </div>
      {/each}
    </div>
  </div>

  {#if arrows && count > 1}
    <button type="button" class="sv-carousel__arrow is-prev" aria-label={rtl ? 'Next slide' : 'Previous slide'} onclick={rtl ? next : prev} disabled={rtl ? (!loop && current === count - 1) : (!loop && current === 0)}>{rtl ? '›' : '‹'}</button>
    <button type="button" class="sv-carousel__arrow is-next" aria-label={rtl ? 'Previous slide' : 'Next slide'} onclick={rtl ? prev : next} disabled={rtl ? (!loop && current === 0) : (!loop && current === count - 1)}>{rtl ? '‹' : '›'}</button>
  {/if}

  {#if dots && count > 1}
    <div class="sv-carousel__dots">
      {#each Array(count) as _, i (i)}
        <button type="button" class="sv-carousel__dot" class:is-active={i === current} aria-label={`Go to slide ${i + 1}`} aria-current={i === current ? 'true' : undefined} onclick={() => go(i)}></button>
      {/each}
    </div>
  {/if}

  {#if autoplay > 0}
    <button
      type="button"
      class="sv-carousel__playpause"
      aria-label={userPaused ? 'Play autoplay' : 'Pause autoplay'}
      aria-pressed={userPaused}
      onclick={() => (userPaused = !userPaused)}
    >{userPaused ? '▶' : '⏸'}</button>
  {/if}
</div>

<style>
  .sv-carousel { position: relative; border-radius: 12px; overflow: hidden; }
  .sv-carousel__viewport { overflow: hidden; touch-action: pan-y; }
  .sv-carousel__track { display: flex; transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
  .sv-carousel__track.is-dragging { transition: none; }
  .sv-carousel__slide { flex: 0 0 100%; min-width: 0; }
  .sv-carousel__slide :global(img) { display: block; width: 100%; height: 100%; object-fit: cover; }

  .sv-carousel__arrow {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
    width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
    background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); cursor: pointer; font-size: 20px; line-height: 1;
    box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.3);
  }
  .sv-carousel__arrow.is-prev { inset-inline-start: 10px; }
  .sv-carousel__arrow.is-next { inset-inline-end: 10px; }
  .sv-carousel__arrow:hover:not(:disabled) { background: var(--sg-bg, #fff); }
  .sv-carousel__arrow:disabled { opacity: 0.4; cursor: default; }

  .sv-carousel__dots { position: absolute; inset-inline: 0; bottom: 10px; display: flex; justify-content: center; gap: 6px; z-index: 2; }
  .sv-carousel__dot {
    width: 8px; height: 8px; border-radius: 50%; border: 0; cursor: pointer; padding: 0;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 30%, var(--sg-bg, #fff)); transition: background 0.15s, width 0.15s;
  }
  .sv-carousel__dot.is-active { width: 20px; border-radius: 4px; background: var(--sg-accent, #2563eb); }

  .sv-carousel__playpause {
    position: absolute; top: 10px; inset-inline-end: 10px; z-index: 2;
    width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%;
    background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); cursor: pointer; font-size: 12px; line-height: 1;
    box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.3);
  }
  .sv-carousel__playpause:hover { background: var(--sg-bg, #fff); }
</style>
