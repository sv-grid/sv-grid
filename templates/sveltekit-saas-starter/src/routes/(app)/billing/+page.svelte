<script lang="ts">
	import { SvAlert, SvBadge, SvButton, SvCard } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import { PLANS } from '#lib/plans.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const current = $derived(PLANS[data.plan]);
	const sub = $derived(data.subscription);

	const money = (cents: number, currency: string) =>
		new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0 }).format(cents / 100);
	const day = (d: Date) => d.toLocaleDateString(undefined, { dateStyle: 'medium' });
	const tone = (status: string) => (status === 'active' || status === 'trialing' ? 'success' : status === 'past_due' ? 'warning' : 'neutral');
</script>

<svelte:head><title>Billing · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Billing</h1>

<div class="grid max-w-xl gap-4">
	{#if data.checkout === 'success' && data.plan === 'pro'}
		<SvAlert variant="success">You are on Pro now. Thank you.</SvAlert>
	{:else if data.checkout === 'success'}
		<SvAlert variant="info">Payment received. Your plan changes as soon as Stripe confirms it; reload in a moment.</SvAlert>
	{:else if data.checkout === 'canceled'}
		<SvAlert variant="info">Checkout canceled. Nothing was charged.</SvAlert>
	{/if}
	{#if form?.message}<SvAlert variant="danger">{form.message}</SvAlert>{/if}

	<SvCard title="Your plan">
		<div class="flex flex-col gap-3">
			<p class="flex items-center gap-2">
				<span class="text-lg font-semibold">{current.name}</span>
				{#if sub}<SvBadge variant={tone(sub.status)} size="sm">{sub.status.replace('_', ' ')}</SvBadge>{/if}
			</p>
			<p class="text-sm text-muted">
				{#if current.projectLimit === null}
					{data.projects} project{data.projects === 1 ? '' : 's'}, no limit.
				{:else if data.projects > current.projectLimit}
					{data.projects} projects; {current.name} holds {current.projectLimit}. Your projects stay, but adding more needs Pro.
				{:else}
					{data.projects} of {current.projectLimit} projects used.
				{/if}
			</p>
			{#if sub && data.plan === 'free'}
				<!-- The latest subscription no longer pays for Pro: canceled, unpaid or never completed. -->
				<p class="text-sm">
					Your Pro subscription is {sub.status.replace('_', ' ')}{sub.endedAt ? ` since ${day(sub.endedAt)}` : ''}.
				</p>
			{:else if sub?.amount != null && sub.currency && sub.interval}
				<p class="text-sm">
					{money(sub.amount, sub.currency)} per {sub.interval}.
					{#if sub.currentPeriodEnd}
						{sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {day(sub.currentPeriodEnd)}.
					{/if}
				</p>
			{/if}
			{#if sub?.status === 'past_due'}
				<SvAlert variant="warning">The last payment failed. Update your card to keep Pro.</SvAlert>
			{/if}
			{#if sub?.sample}
				<p class="text-sm text-muted">This is a sample subscription from the seed data. It is not in Stripe.</p>
			{/if}

			<div class="flex flex-wrap gap-2">
				{#if data.plan === 'free'}
					<form method="POST" action="?/checkout">
						<SvButton type="submit" variant="primary" disabled={!data.billingEnabled}>Upgrade to Pro, {PLANS.pro.price}</SvButton>
					</form>
				{/if}
				{#if data.canManage}
					<form method="POST" action="?/portal">
						<SvButton type="submit" variant="outline">Manage billing</SvButton>
					</form>
				{/if}
			</div>
		</div>
	</SvCard>

	{#if !data.billingEnabled}
		<SvCard title="Billing is not set up">
			<p class="text-sm text-muted">
				Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PRICE_PRO</code> to <code>.env</code> to sell the Pro plan.
				The plan limits apply either way, so you can build on them before you have a Stripe account.
			</p>
		</SvCard>
	{/if}

	<p class="text-sm text-muted"><a href="/pricing" class="underline">Compare plans</a></p>
</div>
