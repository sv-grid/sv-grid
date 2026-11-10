<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvAlert, SvButton, SvPasswordInput } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Choose a new password · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Choose a new password</h1>

{#if data.invalid || !data.token}
	<SvAlert variant="danger">This reset link is invalid or has expired.</SvAlert>
	<p class="mt-5 text-sm"><a class="underline" href="/forgot-password">Send a new link</a></p>
{:else}
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
		<input type="hidden" name="token" value={data.token} />
		<SvPasswordInput block label="New password" name="password" autocomplete="new-password" required />
		<SvButton type="submit" variant="primary" loading={busy}>Save password</SvButton>
	</form>
{/if}
