# Checkout blocks

The pages between the cart and the receipt: a one-page checkout, a stepped
checkout, a payment method picker and the order confirmation. Each block is one
`.svelte` file built from `SvTextInput`, `SvCountryInput`, `SvPhoneInput`,
`SvMaskedInput`, `SvRadioGroup`, `SvStepper`, `SvCheckBox` and `SvButton`, with
money kept in integer cents and formatted with `Intl.NumberFormat`.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/checkout"></div>

See them first with `npx @svgrid/ui try blocks/checkout`. No project needed.

## Split checkout

Contact email, shipping address, delivery speed and card fields on the left; a
sticky order summary with items, subtotal, shipping, tax and total on the right.
Pay checks every field, including a Luhn check on the card number and an expiry
that is not in the past, then shows the button's loading state. Below 820 px the
summary moves above the form and collapses to one row with the total.

<div data-docs-demo="599-block-checkout-split" data-height="1020"></div>

`npx @svgrid/ui add checkout-split`

## Stepped checkout

Shipping, Payment and Review behind an `SvStepper`. Continue validates only the
current step. Review lists the address, phone, delivery speed and card with an
Edit link per section; after an edit, the button reads "Save and review" and
returns straight to Review.

<div data-docs-demo="600-block-checkout-steps" data-height="720"></div>

`npx @svgrid/ui add checkout-steps`

## Payment methods

Four radio cards: Card, Wallet pay, Bank transfer and Invoice. Arrow keys move
between them. The form for the chosen method appears below it: card fields, the
phone that approves a wallet payment, an IBAN with its check digits verified, or
company name, VAT number, country and invoice email for business accounts.
Continue validates the chosen method only.

<div data-docs-demo="601-block-checkout-payment-methods" data-height="720"></div>

`npx @svgrid/ui add checkout-payment-methods`

## Order confirmation

The thank-you page: a drawn check mark, the order number with a copy button, a
delivery window counted in business days from today, the shipping address, what
happens next and the paid summary, with Track order and Continue shopping
actions.

<div data-docs-demo="602-block-checkout-confirmation" data-height="700"></div>

`npx @svgrid/ui add checkout-confirmation`

## Taking the payment

Card numbers should never reach your own server. The `SvMaskedInput` card fields
in these blocks show the layout; in production, mount your payment provider's
hosted fields in their place (the provider's script renders the inputs in its
own frame and hands you a token), or skip card fields entirely and redirect the
shopper to the provider's payment page. Then delete the `card`, `expiry` and
`cvc` checks from the block's validator, since the provider validates its own
fields.

The order itself is created in a SvelteKit form action. Compute the total there
from the cart, not from anything the browser sent, charge the token, and send
the shopper to the confirmation page with a 303:

```ts
// src/routes/checkout/+page.server.ts
import { fail, redirect } from '@sveltejs/kit'
import { createOrder, chargeOrder } from '$lib/server/orders'
import type { Actions } from './$types'

export const actions: Actions = {
  pay: async ({ request, locals }) => {
    const form = await request.formData()
    const token = String(form.get('paymentToken') ?? '')
    if (!token) return fail(400, { message: 'Payment details are missing.' })

    const order = await createOrder(locals.cartId, {
      email: String(form.get('email')),
      name: String(form.get('name')),
      address: String(form.get('address')),
      city: String(form.get('city')),
      postal: String(form.get('postal')),
      country: String(form.get('country')),
      delivery: String(form.get('delivery')),
    })
    const paid = await chargeOrder(order, token) // your provider's server SDK
    if (!paid) return fail(402, { message: 'The card was declined. Nothing was charged.' })

    redirect(303, `/checkout/confirmation/${order.number}`)
  },
}
```

On the page, the split checkout's core calls `onPay` once the form is valid.
Get the token from the hosted fields there and post to the action:

```ts
import { deserialize } from '$app/forms'
import { goto } from '$app/navigation'

const co = createSplitCheckout({
  items: data.cart.items,
  onPay: async (values) => {
    const paymentToken = await hostedFields.tokenize() // the provider's client SDK
    const body = new FormData()
    for (const k of ['email', 'name', 'address', 'city', 'postal', 'country', 'delivery'] as const) {
      body.set(k, String(values[k] ?? ''))
    }
    body.set('paymentToken', paymentToken)
    const res = await fetch('?/pay', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })
    const result = deserialize(await res.text())
    if (result.type === 'redirect') return goto(result.location)
    throw new Error(result.type === 'failure' ? String(result.data?.message) : 'Payment failed')
  },
})
```

A throw keeps the form as it was and clears the loading state. For a redirect
provider, the action creates the order and the provider's payment session
instead, and ends with `redirect(303, session.url)`; the provider sends the
shopper back to your confirmation route.

The stepped checkout works the same way through `createSteppedCheckout({
onPlace })`, which resolves with the order number, and the payment methods block
through `createPaymentMethods({ onSave })`. The confirmation route loads the
order and passes it in:

```ts
// src/routes/checkout/confirmation/[number]/+page.server.ts
import { error } from '@sveltejs/kit'
import { getOrder } from '$lib/server/orders'

export async function load({ params, locals }) {
  const order = await getOrder(params.number, locals.user)
  if (!order) error(404, 'Order not found')
  return { order }
}
```

```ts
const done = createOrderConfirmation({
  order: data.order,
  writeText: (t) => navigator.clipboard.writeText(t),
})
```

## Headless

Each block is a styled render of the core in its `<script module>`:
`createSplitCheckout`, `createSteppedCheckout`, `createPaymentMethods` and
`createOrderConfirmation`. The cores own the values, totals, validation and
async flows and return prop-getters such as `formProps()`,
`summaryToggleProps()`, `stepperProps()`, `groupProps()` and `optionProps()`.
Take a core alone with `npx @svgrid/ui add checkout-split --headless` and draw
your own markup over it.

## See also

- [UI blocks overview](./index.md)
- [SvMaskedInput](../ui-components/sv-masked-input.md)
- [SvStepper](../ui-components/sv-stepper.md)
