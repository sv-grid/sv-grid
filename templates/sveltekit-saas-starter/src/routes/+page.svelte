<script lang="ts">
	import { SvButton } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta name="description" content="{APP_NAME}: replace this with one sentence about your product." />
</svelte:head>

<header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
	<span class="font-semibold">{APP_NAME}</span>
	<nav class="flex items-center gap-2">
		<SvButton href="/pricing" variant="ghost" size="sm">Pricing</SvButton>
		{#if data.signedIn}
			<SvButton href="/dashboard" variant="primary" size="sm">Open the app</SvButton>
		{:else}
			<SvButton href="/login" variant="ghost" size="sm">Sign in</SvButton>
			<SvButton href="/register" variant="primary" size="sm">Get started</SvButton>
		{/if}
	</nav>
</header>

<main class="mx-auto max-w-5xl px-4 py-16">
	<h1 class="max-w-2xl text-4xl font-semibold tracking-tight">Say what your product does in one line.</h1>
	<p class="mt-4 max-w-xl text-lg text-muted">
		This is the public landing page (src/routes/+page.svelte). Sign in to see the app: a dashboard, a projects
		screen, billing, settings, and admin screens for users, subscriptions and the audit log.
	</p>
	<div class="mt-8 flex gap-3">
		<SvButton href="/register" variant="primary">Create an account</SvButton>
		<SvButton href="/login" variant="outline">Sign in</SvButton>
	</div>
</main>
