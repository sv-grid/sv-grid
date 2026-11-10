<script lang="ts">
	import { SvEmptyState, SvGrid, SvStat, type GridColumns } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.soon)[number];

	const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
	const columns: GridColumns<Row> = [
		{ field: 'name', header: 'Project', width: 220 },
		{ field: 'client', header: 'Client', width: 160, hideBelow: 640 },
		{ field: 'status', header: 'Status', width: 110 },
		{ field: 'dueDate', header: 'Due', width: 130, format: { type: 'date', pattern: 'medium' } },
		{ field: 'budget', header: 'Budget', width: 130, hideBelow: 640, format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } }
	];
</script>

<svelte:head><title>Dashboard · {APP_NAME}</title></svelte:head>

<h1 class="mb-4 text-xl font-semibold">Dashboard</h1>

<div class="mb-6 grid gap-3 sm:grid-cols-3">
	<SvStat label="Projects" value={data.totals} />
	<SvStat label="Active" value={data.active} />
	<SvStat label="Open budget" value={money.format(data.openBudget)} hint="Everything not done" />
</div>

<h2 class="mb-2 font-medium">Due in the next 30 days</h2>
{#if data.soon.length}
	<SvGrid data={data.soon} {columns} getRowId={(row) => row.id} fitColumns responsive showRowSelection={false} sortable containerHeight={Math.min(420, 40 + data.soon.length * 36)} />
{:else}
	<SvEmptyState title="Nothing due soon" description="Projects with a due date in the next 30 days show up here." />
{/if}
