import { fail, redirect } from '@sveltejs/kit';
import Stripe from 'stripe';
import { count, eq } from 'drizzle-orm';
import { ORIGIN, STRIPE_PRICE_PRO } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { project } from '#lib/server/db/schema.ts';
import { audit } from '#lib/server/audit.ts';
import { requireUser } from '#lib/server/guards.ts';
import { billingEnabled, customerFor, isSample, planOf, storedCustomer, stripe, syncSubscription } from '#lib/server/billing.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { user } = await parent();

	// Back from Stripe Checkout. The webhook records the subscription too, but
	// it can arrive a few seconds later (or never, locally, without
	// `stripe listen`), so read the session now and show the new plan at once.
	const sessionId = url.searchParams.get('session_id');
	if (stripe && sessionId) {
		const session = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null);
		if (session?.client_reference_id === user.id && typeof session.subscription === 'string') {
			await syncSubscription(session.subscription);
		}
	}

	const [{ plan, subscription }, [{ projects }], customer] = await Promise.all([
		planOf(user.id),
		db.select({ projects: count() }).from(project).where(eq(project.ownerId, user.id)),
		storedCustomer(user.id)
	]);
	return {
		billingEnabled,
		plan,
		projects,
		subscription: subscription && {
			status: subscription.status,
			amount: subscription.amount,
			currency: subscription.currency,
			interval: subscription.interval,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			endedAt: subscription.endedAt,
			sample: isSample(subscription.id)
		},
		canManage: Boolean(stripe && customer && !isSample(customer)),
		checkout: url.searchParams.get('checkout')
	};
};

/**
 * Run a Stripe call and turn its errors into a message on the page. A new
 * Stripe account fails here until it is set up (no portal configuration saved,
 * a price id from the other mode), and Stripe's message says what to fix.
 */
async function fromStripe<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
	try {
		return { ok: true, value: await call() };
	} catch (error) {
		if (error instanceof Stripe.errors.StripeError) {
			console.error('Stripe:', error.message);
			return { ok: false, message: `Stripe refused the request: ${error.message}` };
		}
		throw error;
	}
}

export const actions: Actions = {
	// Plain <form> posts (no use:enhance) so the browser follows the redirect
	// to Stripe's hosted pages.
	checkout: async ({ locals }) => {
		const me = requireUser(locals);
		const api = stripe;
		if (!api || !billingEnabled) return fail(503, { message: 'Billing is not set up. Add STRIPE_SECRET_KEY and STRIPE_PRICE_PRO to .env.' });
		if ((await planOf(me.id)).plan === 'pro') return fail(400, { message: 'You are already on Pro.' });

		const session = await fromStripe(async () =>
			api.checkout.sessions.create({
				mode: 'subscription',
				customer: await customerFor(me),
				client_reference_id: me.id,
				line_items: [{ price: STRIPE_PRICE_PRO!, quantity: 1 }],
				subscription_data: { metadata: { userId: me.id } },
				allow_promotion_codes: true,
				success_url: `${ORIGIN}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${ORIGIN}/billing?checkout=canceled`
			})
		);
		if (!session.ok) return fail(502, { message: session.message });
		await audit(me, 'billing.checkout', undefined, { session: session.value.id });
		// SvelteKit 3 refuses off-site redirects unless asked. This URL comes
		// from Stripe's API, not from the request, and can be a custom domain
		// you set up in Stripe, so allow any.
		redirect(303, session.value.url!, { external: true });
	},

	// Stripe's customer portal: change card, download invoices, cancel.
	portal: async ({ locals }) => {
		const me = requireUser(locals);
		const customer = await storedCustomer(me.id);
		const api = stripe;
		if (!api || !customer || isSample(customer)) return fail(400, { message: 'There is no Stripe billing account to manage yet.' });
		const session = await fromStripe(() => api.billingPortal.sessions.create({ customer, return_url: `${ORIGIN}/billing` }));
		if (!session.ok) return fail(502, { message: session.message });
		redirect(303, session.value.url, { external: true });
	}
};
