<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvAlert, SvButton, SvTextInput } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	const sentTo = $derived(form && 'sent' in form ? form.email : null);
</script>

<svelte:head><title>Reset password · {APP_NAME}</title></svelte:head>

<h1 class="mb-2 text-xl font-semibold">Reset your password</h1>

{#if sentTo}
	<SvAlert variant="success">If {sentTo} has an account, a reset link is on its way. It works for an hour.</SvAlert>
{:else}
	<p class="mb-4 text-sm text-muted">We'll email you a link to choose a new one.</p>
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
		<SvTextInput block label="Email" name="email" type="email" autocomplete="email" required />
		<SvButton type="submit" variant="primary" loading={busy}>Send reset link</SvButton>
	</form>
{/if}

<p class="mt-5 text-sm text-muted"><a class="text-ink underline" href="/login">Back to sign in</a></p>
