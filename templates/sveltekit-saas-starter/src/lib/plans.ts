// What each plan includes. Shared by the pricing page, the billing page and
// the server checks, so the page can't promise something the server refuses.
//
// The price shown here is display text only. What people pay is the Stripe
// price in STRIPE_PRICE_PRO; change both together.

export const PLAN_IDS = ['free', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
	name: string;
	price: string;
	/** Most projects one account can hold; null means no limit. */
	projectLimit: number | null;
	features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
	free: {
		name: 'Free',
		price: '$0',
		projectLimit: 15,
		features: ['Up to 15 projects', 'Edit in the grid', 'Email support']
	},
	pro: {
		name: 'Pro',
		price: '$12 per month',
		projectLimit: null,
		features: ['Unlimited projects', 'Everything in Free', 'Priority support']
	}
};

/**
 * Stripe subscription statuses that keep paid features on. `past_due` stays
 * in: Stripe is still retrying the card, and cutting access on the first
 * failed charge loses customers whose card simply expired.
 */
export const PAID_STATUSES = ['active', 'trialing', 'past_due'] as const;
