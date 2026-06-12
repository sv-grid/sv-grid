<script lang="ts">
  /**
   * Renders a PayPal subscription button for a specific sv-grid-pro plan.
   *
   * Lifecycle:
   *   1. Mount → loadPayPalSdk() (singleton, lazy)
   *   2. SDK ready → paypal.Buttons({...}).render(container)
   *   3. User pays → onApprove fires → we lift the subscriptionID up via
   *      the `onSubscribe` callback prop
   *   4. Errors / SDK failures → fallback contact link
   *
   * The button automatically handles cancel and approve states; we forward
   * approve to the parent so it can swap the card to a "thank you" state.
   */
  import { onMount } from 'svelte'
  import {
    loadPayPalSdk,
    PAYPAL_CLIENT_ID,
    type PayPalApproveData,
    type PayPalButtonStyle,
  } from '../lib/paypal'

  type Props = {
    /** The PayPal plan ID to subscribe to. */
    planId: string
    /** Friendly label used in the fallback link's accessible name. */
    planLabel: string
    /** Email (or contact route) to use as the fallback CTA. */
    fallbackHref?: string
    /** Optional style override for the PayPal Buttons widget. */
    style?: PayPalButtonStyle
    /**
     * Pre-fills the PayPal subscriber object so the merchant dashboard
     * shows the right buyer name + email without the user retyping it in
     * the PayPal popup.
     */
    subscriberDetails?: {
      firstName?: string
      lastName?: string
      email?: string
      company?: string
      vat?: string
    }
    /**
     * Subscription quantity - drives the per-developer multiplier on the
     * PayPal plan. Plans must have `quantity_supported: true` configured
     * in PayPal. Coerced to an integer string before passing to the SDK.
     */
    quantity?: number
    /** Brand name shown in the PayPal review screen. */
    brandName?: string
    /** Fires on successful approval. Receives the PayPal data payload. */
    onSubscribe?: (data: PayPalApproveData) => void
    /** Fires when the user closes the PayPal popup without subscribing. */
    onCancel?: () => void
  }

  let {
    planId,
    planLabel,
    fallbackHref = '#/contact',
    style,
    subscriberDetails,
    quantity,
    brandName = 'SvGrid Pro',
    onSubscribe,
    onCancel,
  }: Props = $props()

  import type { PayPalButtonsInstance } from '../lib/paypal'

  let container: HTMLDivElement | null = $state(null)
  let status = $state<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  let errorMessage = $state<string | null>(null)

  onMount(() => {
    // If the client-id wasn't configured at build time we don't even try to
    // load the SDK - the sandbox sentinel ('sb') would mount but fail on
    // approval because there's no real merchant account behind it. Show the
    // fallback contact button instead.
    if (!PAYPAL_CLIENT_ID || PAYPAL_CLIENT_ID === 'sb') {
      status = 'unconfigured'
      return
    }

    let destroyed = false
    let buttonInstance: PayPalButtonsInstance | null = null

    loadPayPalSdk()
      .then((paypal) => {
        if (destroyed || !container) return
        const instance = paypal.Buttons({
          // Default PayPal styling (gold "Subscribe" pill) - matches the
          // checkout button shoppers recognize on every other PayPal-backed
          // site. The host (BuyDialog modal) controls the surrounding
          // surface; PayPal stays as PayPal.
          style: {
            shape: 'pill',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe',
            height: 45,
            ...style,
          },
          createSubscription(_data, actions) {
            // Build a PayPal subscriber object from the form data. Empty
            // strings are dropped so PayPal doesn't reject an "" email.
            const sd = subscriberDetails
            const subscriber: {
              name?: { given_name?: string; surname?: string }
              email_address?: string
            } = {}
            if (sd?.firstName || sd?.lastName) {
              subscriber.name = {}
              if (sd.firstName?.trim()) subscriber.name.given_name = sd.firstName.trim()
              if (sd.lastName?.trim()) subscriber.name.surname = sd.lastName.trim()
            }
            if (sd?.email?.trim()) subscriber.email_address = sd.email.trim()

            // custom_id is a free-form merchant tag attached to the
            // subscription. PayPal caps it at 127 chars. Pack company +
            // VAT into a compact `co=...; vat=...` form so the values show
            // up directly in the PayPal dashboard.
            const customParts: string[] = []
            if (sd?.company?.trim()) customParts.push(`co=${sd.company.trim()}`)
            if (sd?.vat?.trim()) customParts.push(`vat=${sd.vat.trim()}`)
            const custom_id = customParts.join(' | ').slice(0, 127) || undefined

            // PayPal expects `quantity` as a stringified positive integer.
            // Clamp to [1, 9999] so an out-of-range value can never reach
            // the API.
            const qty =
              typeof quantity === 'number' && Number.isFinite(quantity)
                ? Math.max(1, Math.min(9999, Math.floor(quantity)))
                : 1

            return actions.subscription.create({
              plan_id: planId,
              quantity: String(qty),
              ...(Object.keys(subscriber).length > 0 ? { subscriber } : {}),
              ...(custom_id ? { custom_id } : {}),
              application_context: {
                brand_name: brandName,
                shipping_preference: 'NO_SHIPPING',
                user_action: 'SUBSCRIBE_NOW',
              },
            })
          },
          onApprove(data) {
            // The PayPal SDK guarantees subscriptionID for subscription
            // intent. We still treat it as optional for defensive typing.
            onSubscribe?.(data)
          },
          onCancel() {
            onCancel?.()
          },
          onError(err: unknown) {
            console.error('[sv-grid] PayPal button error', err)
            errorMessage = err instanceof Error ? err.message : 'PayPal returned an error.'
            status = 'error'
          },
        })
        buttonInstance = instance
        instance.render(container).then(
          () => {
            if (!destroyed) status = 'ready'
          },
          (err: unknown) => {
            if (destroyed) return
            console.error('[sv-grid] PayPal render failed', err)
            errorMessage = err instanceof Error ? err.message : 'PayPal failed to render.'
            status = 'error'
          },
        )
      })
      .catch((err: unknown) => {
        if (destroyed) return
        console.error('[sv-grid] PayPal SDK load failed', err)
        errorMessage = err instanceof Error ? err.message : 'PayPal SDK failed to load.'
        status = 'error'
      })

    return () => {
      destroyed = true
      // PayPal supplies close() on the button instance to detach cleanly.
      // Errors here are harmless; the iframe just won't be removed.
      buttonInstance?.close?.().catch(() => {})
    }
  })
</script>

{#if status === 'loading'}
  <div
    class="paypal-skeleton"
    aria-label="Loading PayPal checkout"
    role="status"
  ></div>
{/if}

<!-- The container is always present in the DOM so onMount has a node to
     pass to render(). PayPal injects its iframe into it once status flips
     to 'ready'. -->
<div bind:this={container} class="paypal-container" class:is-ready={status === 'ready'}></div>

{#if status === 'unconfigured'}
  <a
    href={fallbackHref}
    class="paypal-fallback"
    aria-label={`Contact sales for ${planLabel}`}
  >
    Contact sales to purchase {planLabel}
  </a>
  <p class="paypal-note">
    Self-serve checkout requires <code>VITE_PAYPAL_CLIENT_ID</code> at build time.
    Meanwhile, email <a href="mailto:sales@jqwidgets.com">sales@jqwidgets.com</a>.
  </p>
{:else if status === 'error'}
  <a
    href={fallbackHref}
    class="paypal-fallback"
    aria-label={`Contact sales for ${planLabel}`}
  >
    Couldn't load PayPal - contact sales for {planLabel}
  </a>
  {#if errorMessage}
    <p class="paypal-note" style="color: #f87171;">{errorMessage}</p>
  {/if}
{/if}

<style>
  .paypal-container {
    min-height: 0;
    transition: min-height 200ms ease;
    /* Soft rounded clip so PayPal's white button picks up our radius and
     * doesn't look like a foreign rectangle stuck on a card. */
    border-radius: 10px;
    overflow: hidden;
  }
  .paypal-container.is-ready {
    min-height: 44px;
  }

  /* Loading skeleton - matches the 44px PayPal Buttons height and uses
   * site tokens so it adapts to both highlight + non-highlight cards
   * without looking foreign. */
  .paypal-skeleton {
    height: 44px;
    border-radius: 10px;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--sg-fg, #e8ecf6) 7%, transparent) 0%,
        color-mix(in srgb, var(--sg-fg, #e8ecf6) 14%, transparent) 50%,
        color-mix(in srgb, var(--sg-fg, #e8ecf6) 7%, transparent) 100%
      );
    background-size: 200% 100%;
    animation: paypal-skel 1.4s ease-in-out infinite;
    border: 1px solid var(--sg-border, #25324f);
  }
  @keyframes paypal-skel {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }

  /* Error / unconfigured fallback - mirrors the .btn .btn-ghost system
   * exactly so it sits at the same height as Community's "Install from
   * npm" CTA. */
  .paypal-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    height: 44px;
    padding: 0 1.25rem;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    background: var(--site-bg-elev, #1a2238);
    color: var(--site-fg, #e8ecf6);
    border: 1px solid var(--site-border, #25324f);
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }
  .paypal-fallback:hover {
    background: var(--sg-row-hover-bg, #232b3c);
    border-color: var(--site-accent, #3b82f6);
  }

  .paypal-note {
    margin-top: 0.55rem;
    font-size: 0.72rem;
    color: var(--site-muted, #9aa6c2);
    line-height: 1.45;
  }
  .paypal-note code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: color-mix(in srgb, var(--sg-fg, #e8ecf6) 8%, transparent);
    padding: 0 0.3rem;
    border-radius: 4px;
    font-size: 0.95em;
  }
  .paypal-note a {
    color: var(--site-accent-2, #22d3ee);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
