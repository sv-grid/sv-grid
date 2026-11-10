import Stripe from 'stripe';
import { count, desc, eq } from 'drizzle-orm';
import { STRIPE_PRICE_PRO, STRIPE_SECRET_KEY } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { billingCustomer, project, subscription, user } from '#lib/server/db/schema.ts';
import { PAID_STATUSES, PLANS, type PlanId } from '#lib/plans.ts';

// Everything that talks to Stripe. Pages and the webhook call these helpers;
// nothing else imports the Stripe SDK.

export const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/** Both keys are needed to sell anything: the API key and the Pro price. */
export const billingEnabled = Boolean(stripe && STRIPE_PRICE_PRO);

/** Seeded rows use these ids. They are not in Stripe, so the portal can't open them. */
export const isSample = (id: string) => id.startsWith('sub_sample_') || id.startsWith('cus_sample_');

export type PlanState = {
	plan: PlanId;
	/** The subscription that grants the plan, or the latest one if none does. */
	subscription: typeof subscription.$inferSelect | null;
};

/** The plan an account is on now: Pro while any of its subscriptions is paid up. */
export async function planOf(userId: string): Promise<PlanState> {
	const rows = await db.select().from(subscription).where(eq(subscription.userId, userId)).orderBy(desc(subscription.createdAt));
	const paid = rows.find((s) => (PAID_STATUSES as readonly string[]).includes(s.status));
	return { plan: paid?.plan ?? 'free', subscription: paid ?? rows[0] ?? null };
}

/**
 * The plan gate. Returns null when the account may add another project, or
 * the reason it can't. Call it in the action that creates the row, not only
 * in the page, so a hand-made POST meets the same limit.
 */
export async function projectLimitReached(userId: string): Promise<string | null> {
	const { plan } = await planOf(userId);
	const limit = PLANS[plan].projectLimit;
	if (limit === null) return null;
	const [{ n }] = await db.select({ n: count() }).from(project).where(eq(project.ownerId, userId));
	return n >= limit ? `The ${PLANS[plan].name} plan holds ${limit} projects. Upgrade to Pro for unlimited projects.` : null;
}

/** The account's Stripe customer id, creating the customer on first use. */
export async function customerFor(me: { id: string; email: string; name: string }): Promise<string> {
	if (!stripe) throw new Error('Stripe is not configured');
	const [row] = await db.select().from(billingCustomer).where(eq(billingCustomer.userId, me.id));
	if (row) return row.customerId;
	const customer = await stripe.customers.create({ email: me.email, name: me.name, metadata: { userId: me.id } });
	// Two checkouts started at the same moment both get here; the second
	// insert does nothing and both use the customer that was stored.
	await db.insert(billingCustomer).values({ userId: me.id, customerId: customer.id }).onConflictDoNothing();
	const [stored] = await db.select().from(billingCustomer).where(eq(billingCustomer.userId, me.id));
	return stored.customerId;
}

/** The account's stored Stripe customer id, or null before its first checkout. */
export async function storedCustomer(userId: string): Promise<string | null> {
	const [row] = await db.select().from(billingCustomer).where(eq(billingCustomer.userId, userId));
	return row?.customerId ?? null;
}

function planForPrice(priceId: string | undefined): PlanId {
	return priceId && priceId === STRIPE_PRICE_PRO ? 'pro' : 'free';
}

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/**
 * Copy one subscription from Stripe into the database. Reads the current
 * state from Stripe instead of trusting the event body, so a late or
 * repeated event writes the same, current row. Returns the account it
 * belongs to, or null when the customer isn't one of ours.
 */
export async function syncSubscription(subscriptionId: string): Promise<{ userId: string; email: string; status: string; plan: PlanId } | null> {
	if (!stripe) throw new Error('Stripe is not configured');
	const sub = await stripe.subscriptions.retrieve(subscriptionId);
	const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

	const [owner] = await db.select().from(billingCustomer).where(eq(billingCustomer.customerId, customerId));
	const [account] = await db
		.select({ id: user.id, email: user.email })
		.from(user)
		.where(eq(user.id, owner?.userId ?? sub.metadata?.userId ?? ''));
	if (!account) return null;
	const userId = account.id;

	const item = sub.items.data[0];
	const price = item?.price;
	const values = {
		userId,
		customerId,
		status: sub.status,
		plan: planForPrice(price?.id),
		priceId: price?.id ?? null,
		amount: price?.unit_amount ?? null,
		currency: price?.currency ?? null,
		interval: price?.recurring?.interval ?? null,
		// Since API version 2025-03-31 the billing period is on each item.
		currentPeriodEnd: toDate(item?.current_period_end),
		cancelAtPeriodEnd: sub.cancel_at_period_end || Boolean(sub.cancel_at),
		endedAt: toDate(sub.ended_at)
	};
	await db
		.insert(subscription)
		.values({ id: sub.id, createdAt: toDate(sub.created) ?? new Date(), ...values })
		.onConflictDoUpdate({ target: subscription.id, set: { ...values, updatedAt: new Date() } });
	return { userId, email: account.email, status: sub.status, plan: values.plan };
}
