<script lang="ts">
	import { SvButton } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import { PLAN_IDS, PLANS } from '#lib/plans.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Pricing · {APP_NAME}</title>
	<meta name="description" content="{APP_NAME} plans and prices." />
</svelte:head>

<header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
	<a href="/" class="font-semibold">{APP_NAME}</a>
	<nav class="flex items-center gap-2">
		{#if data.signedIn}
			<SvButton href="/dashboard" variant="primary" size="sm">Open the app</SvButton>
		{:else}
			<SvButton href="/login" variant="ghost" size="sm">Sign in</SvButton>
		{/if}
	</nav>
</header>

<main class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="text-3xl font-semibold tracking-tight">Pricing</h1>
	<p class="mt-2 text-muted">Start free. Upgrade when you need more projects; cancel any time from the billing page.</p>

	<div class="mt-8 grid gap-4 sm:grid-cols-2">
		{#each PLAN_IDS as id (id)}
			{@const plan = PLANS[id]}
			<section
				class="flex flex-col rounded-lg border bg-surface p-5 {id === 'pro' ? 'border-accent' : 'border-line'}"
				aria-labelledby="plan-{id}"
			>
				<h2 id="plan-{id}" class="text-lg font-semibold">{plan.name}</h2>
				<p class="mt-1 text-2xl font-semibold">{plan.price}</p>
				<ul class="mt-4 flex-1 space-y-1.5 text-sm">
					{#each plan.features as feature (feature)}<li>{feature}</li>{/each}
				</ul>
				<div class="mt-5">
					{#if data.plan === id}
						<SvButton href="/billing" variant="outline" block>Your plan</SvButton>
					{:else if id === 'free'}
						<SvButton href={data.signedIn ? '/dashboard' : '/register'} variant="outline" block>
							{data.signedIn ? 'Open the app' : 'Start free'}
						</SvButton>
					{:else if data.signedIn}
						<!-- Posts to the billing page's checkout action, which redirects to Stripe. -->
						<form method="POST" action="/billing?/checkout">
							<SvButton type="submit" variant="primary" block>Upgrade to {plan.name}</SvButton>
						</form>
					{:else}
						<SvButton href="/register?next=/billing" variant="primary" block>Start with {plan.name}</SvButton>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</main>
