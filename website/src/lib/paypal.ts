// PayPal subscription integration for the Pricing page.
//
// We use the PayPal JS SDK in "subscription" mode. The SDK is loaded once per
// page lifetime (singleton promise) and then the same global `window.paypal`
// is used to render N buttons.
//
// Two plan IDs are pinned to the live PayPal subscription plans:
//   - @svgrid/enterprise Single Application Developer License
//   - @svgrid/enterprise Multiple Application Developer License
//
// The PayPal client-id is a public credential (analogous to a Stripe
// publishable key) - safe to bundle in the client. We still read it from
// VITE_PAYPAL_CLIENT_ID at build time so the env-specific value (live vs.
// sandbox) can be swapped without code changes.

export const PAYPAL_PLAN_IDS = {
  /** @svgrid/enterprise - Single Application Developer License ($599/dev/yr). */
  proSingleApp: 'P-3N517466PB672681XNINVX4I',
  /** @svgrid/enterprise - Multiple Application Developer License ($999/dev/yr). */
  proMultiApp: 'P-9N961750GE1769819NINVYIQ',
} as const

export type PayPalPlanKey = keyof typeof PAYPAL_PLAN_IDS

/**
 * The PayPal client-id for the jQWidgets merchant account that owns the
 * @svgrid/enterprise subscription plans (same account that backs htmlelements.com
 * checkout). Public credential - analogous to a Stripe publishable key -
 * safe to ship in the client bundle.
 *
 * Build-time override: set `VITE_PAYPAL_CLIENT_ID` (e.g. for sandbox
 * environments). Setting it to the literal "sb" suppresses the SDK and
 * turns the buttons into "Contact sales" fallbacks - useful when you want
 * to disable real checkout in a staging deploy without removing wiring.
 */
const DEFAULT_PAYPAL_CLIENT_ID =
  'AYor43h8U5H7JZE-l73WQ8Zc86Hbd9o0AbpmEhTvz3Sem8MkBqBs5B0zAFbLdFcJueTpxV6aFQ4n5Vde'

export const PAYPAL_CLIENT_ID =
  (import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined) ?? DEFAULT_PAYPAL_CLIENT_ID

let sdkPromise: Promise<PayPalNamespace> | null = null

/**
 * Lazy, idempotent loader for the PayPal JS SDK. Subsequent calls return the
 * same promise. If the script tag exists already (e.g. fast-refresh re-mount)
 * we wait for `window.paypal` instead of injecting a duplicate.
 */
export function loadPayPalSdk(): Promise<PayPalNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PayPal SDK can only be loaded in the browser'))
  }
  if ((window as any).paypal) {
    return Promise.resolve((window as any).paypal as PayPalNamespace)
  }
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<PayPalNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-svgrid-paypal]')
    const onLoad = () => {
      const ns = (window as any).paypal as PayPalNamespace | undefined
      if (ns) resolve(ns)
      else reject(new Error('PayPal SDK loaded but window.paypal is missing'))
    }
    const onError = () => reject(new Error('PayPal SDK script failed to load'))

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }

    const params = new URLSearchParams({
      'client-id': PAYPAL_CLIENT_ID,
      vault: 'true',
      intent: 'subscription',
      // Brand the wallet a little and keep funding focused on PayPal +
      // credit/debit cards (drop wallet alternatives that distract).
      'disable-funding': 'credit',
    })
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`
    script.async = true
    script.dataset.svgridPaypal = 'true'
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })

  return sdkPromise
}

// ---- Minimal type surface for the bits of the SDK we touch ----------------

export type PayPalButtonStyle = {
  shape?: 'rect' | 'pill'
  color?: 'gold' | 'blue' | 'silver' | 'white' | 'black'
  layout?: 'vertical' | 'horizontal'
  label?: 'subscribe' | 'paypal' | 'checkout' | 'buynow' | 'pay'
  height?: number
}

export type PayPalApproveData = {
  subscriptionID?: string | null
  orderID?: string
  facilitatorAccessToken?: string
  payerID?: string | null
  paymentID?: string | null
  billingToken?: string | null
}

export type PayPalButtonOptions = {
  style?: PayPalButtonStyle
  createSubscription(data: unknown, actions: PayPalSubscriptionActions): Promise<string> | string
  onApprove(data: PayPalApproveData, actions: unknown): void | Promise<void>
  onError?(err: unknown): void
  onCancel?(data: unknown): void
}

export type PayPalSubscriberName = {
  given_name?: string
  surname?: string
}

export type PayPalSubscriberInput = {
  name?: PayPalSubscriberName
  email_address?: string
}

export type PayPalApplicationContext = {
  brand_name?: string
  locale?: string
  shipping_preference?: 'NO_SHIPPING' | 'GET_FROM_FILE' | 'SET_PROVIDED_ADDRESS'
  user_action?: 'SUBSCRIBE_NOW' | 'CONTINUE'
}

export type PayPalCreateSubscriptionInput = {
  plan_id: string
  /** Stringified positive integer. PayPal plan must have quantity_supported: true. */
  quantity?: string
  custom_id?: string
  subscriber?: PayPalSubscriberInput
  application_context?: PayPalApplicationContext
}

export type PayPalSubscriptionActions = {
  subscription: {
    create(input: PayPalCreateSubscriptionInput): Promise<string> | string
  }
}

export type PayPalButtonsInstance = {
  render(container: HTMLElement): Promise<void>
  close?(): Promise<void>
  isEligible?(): boolean
}

export type PayPalNamespace = {
  Buttons(options: PayPalButtonOptions): PayPalButtonsInstance
}
