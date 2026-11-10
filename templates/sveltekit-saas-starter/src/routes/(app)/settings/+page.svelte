<script lang="ts">
	import { enhance } from '$app/forms';
	import { SvAlert, SvButton, SvCard, SvPasswordInput, SvTextInput } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const profile = $derived(form && 'profile' in form ? form : null);
	const password = $derived(form && 'password' in form ? form : null);
</script>

<svelte:head><title>Settings · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Settings</h1>

<div class="grid max-w-xl gap-4">
	<SvCard title="Profile">
		<form method="POST" action="?/profile" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex flex-col gap-3">
			{#if profile?.message}<SvAlert variant="danger">{profile.message}</SvAlert>{/if}
			{#if profile?.saved}<SvAlert variant="success">Saved.</SvAlert>{/if}
			<SvTextInput block label="Name" name="name" autocomplete="name" required value={data.user.name} />
			<p class="text-sm text-muted">Email: {data.user.email}</p>
			<div><SvButton type="submit" variant="primary">Save</SvButton></div>
		</form>
	</SvCard>

	<SvCard title="Password">
		<form method="POST" action="?/password" use:enhance class="flex flex-col gap-3">
			{#if password?.message}<SvAlert variant="danger">{password.message}</SvAlert>{/if}
			{#if password?.saved}<SvAlert variant="success">Password changed. Other devices were signed out.</SvAlert>{/if}
			<SvPasswordInput block label="Current password" name="current" autocomplete="current-password" required />
			<SvPasswordInput block label="New password" name="next" autocomplete="new-password" required />
			<div><SvButton type="submit" variant="primary">Change password</SvButton></div>
		</form>
	</SvCard>
</div>
