<script lang="ts">
	import { SvBadge, SvEmptyState, SvGrid, SvStat, renderSnippet, type GridColumns } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.rows)[number];

	const money = (cents: number, currency: string) =>
		new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
	const label = (status: string) => status.replace('_', ' ');
	const tone = (status: string) =>
		status === 'active' ? 'success' : status === 'trialing' ? 'info' : status === 'past_due' || status === 'unpaid' ? 'warning' : 'neutral';

	const columns: GridColumns<Row> = [
		{ field: 'email', header: 'Customer', width: 240 },
		{ field: 'plan', header: 'Plan', width: 90, hideBelow: 640 },
		{
			field: 'status',
			header: 'Status',
			width: 120,
			cell: (ctx) => renderSnippet(statusBadge, { row: ctx.row.original })
		},
		{
			field: 'amount',
			header: 'Price',
			width: 120,
			hideBelow: 640,
			// Cents in the database; the row's own currency on screen. Sorting stays numeric.
			formatter: ({ value, row }) =>
				value == null || !row.original.currency ? '' : `${money(value as number, row.original.currency)} / ${row.original.interval ?? 'month'}`
		},
		{ field: 'currentPeriodEnd', header: 'Period ends', width: 150, hideBelow: 900, format: { type: 'date', pattern: 'medium' } },
		{ field: 'createdAt', header: 'Started', width: 150, hideBelow: 900, format: { type: 'date', pattern: 'medium' } },
		// Search for this id in the Stripe dashboard to see invoices and events.
		{ field: 'id', header: 'Stripe id', width: 200, hideBelow: 1100 }
	];
</script>

{#snippet statusBadge(p: { row: Row })}
	<span class="flex items-center gap-1">
		<SvBadge variant={tone(p.row.status)} size="sm">{label(p.row.status)}</SvBadge>
		{#if p.row.cancelAtPeriodEnd && p.row.status !== 'canceled'}<span class="text-xs text-muted">ending</span>{/if}
	</span>
{/snippet}

<svelte:head><title>Subscriptions · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Subscriptions</h1>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
	<SvStat label="MRR" value={data.mrr.map((m) => money(m.cents, m.currency!)).join(' + ') || money(0, 'usd')} hint="Active, trialing and past due" />
	<SvStat label="Active" value={data.filters.find((f) => f.id === 'active')?.n ?? 0} />
	<SvStat label="Past due" value={data.filters.find((f) => f.id === 'past_due')?.n ?? 0} hint="Stripe is retrying the card" />
</div>

<!-- Links, not buttons: the filter lives in the URL, so a filtered view can be shared and survives a reload. -->
<nav class="mb-3 flex flex-wrap gap-2" aria-label="Filter by status">
	{#each data.filters as f (f.id)}
		<a
			href={f.id === 'all' ? '?' : `?status=${f.id}`}
			aria-current={data.filter === f.id ? 'page' : undefined}
			class="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink aria-[current=page]:border-accent aria-[current=page]:text-ink"
		>
			{f.id === 'all' ? 'All' : label(f.id)} <span class="tabular-nums">{f.n}</span>
		</a>
	{/each}
</nav>

{#if data.rows.length}
	{#if data.capped}<p class="mb-2 text-sm text-muted">Showing the newest {data.rows.length}.</p>{/if}
	<SvGrid
		data={data.rows}
		{columns}
		getRowId={(row) => row.id}
		sortable
		filterable
		fitColumns
		responsive
		showRowSelection={false}
		containerHeight={520}
	/>
{:else}
	<SvEmptyState
		title="No subscriptions here"
		description="Rows appear when Stripe sends the webhook for a new checkout. See the billing section of the README to test it locally."
	/>
{/if}
