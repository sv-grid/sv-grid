<script lang="ts">
	import { page } from '$app/state';
	import { SvAvatar, SvButton } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const main = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/projects', label: 'Projects' },
		{ href: '/billing', label: 'Billing' },
		{ href: '/settings', label: 'Settings' }
	];
	const admin = [
		{ href: '/admin/users', label: 'Users' },
		{ href: '/admin/subscriptions', label: 'Subscriptions' },
		{ href: '/admin/audit', label: 'Audit log' }
	];
	const isAdmin = $derived(data.user.role === 'admin');
	const current = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

{#snippet link(item: { href: string; label: string })}
	<a
		href={item.href}
		aria-current={current(item.href) ? 'page' : undefined}
		class="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-ink aria-[current=page]:bg-subtle aria-[current=page]:font-medium aria-[current=page]:text-ink"
	>
		{item.label}
	</a>
{/snippet}

{#snippet account()}
	<div class="flex items-center gap-3">
		<span class="flex items-center gap-2 text-sm">
			<SvAvatar name={data.user.name} src={data.user.image ?? undefined} size="sm" />
			<span class="hidden lg:inline">{data.user.name}</span>
		</span>
		<form method="POST" action="/logout">
			<SvButton type="submit" variant="ghost" size="sm">Sign out</SvButton>
		</form>
	</div>
{/snippet}

<div class="min-h-screen md:grid md:grid-cols-[13rem_1fr]">
	<aside class="border-b border-line bg-surface md:min-h-screen md:border-r md:border-b-0">
		<div class="flex items-center justify-between gap-3 px-4 py-3 md:block">
			<a href="/dashboard" class="font-semibold">{APP_NAME}</a>
			<!-- On phones the account controls sit here; from md up they move to the header. -->
			<div class="md:hidden">{@render account()}</div>
		</div>
		<nav class="flex flex-wrap gap-1 px-2 pb-2 md:flex-col md:flex-nowrap" aria-label="Main">
			{#each main as item (item.href)}{@render link(item)}{/each}
			{#if isAdmin}
				<p class="mt-4 hidden px-3 text-xs font-medium tracking-wide text-muted uppercase md:block">Admin</p>
				{#each admin as item (item.href)}{@render link(item)}{/each}
			{/if}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-col">
		<header class="hidden items-center justify-end border-b border-line bg-surface px-4 py-2 md:flex">
			{@render account()}
		</header>
		<main class="min-w-0 flex-1 p-4 md:p-6">
			{@render children()}
		</main>
	</div>
</div>
