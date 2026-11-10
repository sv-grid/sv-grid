<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvAlert, SvButton, SvPasswordInput, SvTextInput } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	const next = $derived(page.url.searchParams.get('next'));
	const query = $derived(next ? `?next=${encodeURIComponent(next)}` : '');
</script>

<svelte:head><title>Create account · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Create your account</h1>

{#if form?.message}
	<div class="mb-4"><SvAlert variant="danger">{form.message}</SvAlert></div>
{/if}

<form
	method="POST"
	class="flex flex-col gap-3"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<SvTextInput block label="Name" name="name" autocomplete="name" required value={form?.name ?? ''} />
	<SvTextInput block label="Email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
	<SvPasswordInput block label="Password" name="password" autocomplete="new-password" required />
	<SvButton type="submit" variant="primary" loading={busy}>Create account</SvButton>
</form>

<p class="mt-5 text-sm text-muted">Have an account? <a class="text-ink underline" href="/login{query}">Sign in</a></p>
