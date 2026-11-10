<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvAlert, SvButton, SvPasswordInput, SvTextInput } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	const next = $derived(page.url.searchParams.get('next'));
	const query = $derived(next ? `?next=${encodeURIComponent(next)}` : '');
	// Named actions read the action from the query string, so ?next= rides along.
	const keepNext = $derived(next ? `&next=${encodeURIComponent(next)}` : '');
</script>

<svelte:head><title>Sign in · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Sign in</h1>

{#if data.reset}
	<div class="mb-4"><SvAlert variant="success">Password changed. Sign in with the new one.</SvAlert></div>
{/if}
{#if form?.message}
	<div class="mb-4"><SvAlert variant="danger">{form.message}</SvAlert></div>
{/if}

<form
	method="POST"
	action="?/email{keepNext}"
	class="flex flex-col gap-3"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<SvTextInput block label="Email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
	<SvPasswordInput block label="Password" name="password" autocomplete="current-password" required />
	<div class="flex justify-end text-sm">
		<a class="text-muted underline" href="/forgot-password">Forgot password?</a>
	</div>
	<SvButton type="submit" variant="primary" loading={busy}>Sign in</SvButton>
</form>

{#if data.githubEnabled}
	<form method="POST" action="?/github{keepNext}" class="mt-3 flex flex-col">
		<SvButton type="submit" variant="outline">Continue with GitHub</SvButton>
	</form>
{/if}

<p class="mt-5 text-sm text-muted">No account? <a class="text-ink underline" href="/register{query}">Create one</a></p>
