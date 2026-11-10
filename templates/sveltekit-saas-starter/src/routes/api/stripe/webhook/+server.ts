import { error, json } from '@sveltejs/kit';
import type Stripe from 'stripe';
import { STRIPE_WEBHOOK_SECRET } from '$app/env/private';
import { stripe, syncSubscription } from '#lib/server/billing.ts';
import { audit } from '#lib/server/audit.ts';
import type { RequestHandler } from './$types';

// Stripe calls this after a checkout and on every subscription change. Add
// the endpoint in the Stripe dashboard (or run `stripe listen`) with at least
// these events: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
//
// No session check here: Stripe is not signed in. The signature check below is
// what keeps forged requests out.

const SUBSCRIPTION_EVENTS = new Set([
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'customer.subscription.paused',
	'customer.subscription.resumed'
]);

export const POST: RequestHandler = async ({ request }) => {
	if (!stripe || !STRIPE_WEBHOOK_SECRET) error(503, 'Stripe webhooks are not set up');

	// The signature covers the exact bytes Stripe sent, so read the raw body.
	const body = await request.text();
	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(body, request.headers.get('stripe-signature') ?? '', STRIPE_WEBHOOK_SECRET);
	} catch {
		error(400, 'Invalid signature');
	}

	let subscriptionId: string | null = null;
	if (event.type === 'checkout.session.completed') {
		const session = event.data.object;
		if (session.mode === 'subscription' && session.subscription) {
			subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
		}
	} else if (SUBSCRIPTION_EVENTS.has(event.type)) {
		subscriptionId = (event.data.object as Stripe.Subscription).id;
	}

	if (subscriptionId) {
		// A throw here answers 500 and Stripe retries the event later.
		const synced = await syncSubscription(subscriptionId);
		if (synced) {
			await audit({ id: synced.userId, email: synced.email }, 'billing.subscription', `subscription:${subscriptionId}`, {
				event: event.type,
				status: synced.status,
				plan: synced.plan
			});
		} else {
			console.warn(`Stripe ${event.type}: subscription ${subscriptionId} has no matching account; ignored`);
		}
	}
	// 200 for every verified event, handled or not, or Stripe keeps retrying.
	return json({ received: true });
};
