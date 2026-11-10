<script lang="ts">
	import { SvBadge, SvGrid, createServerDataSource, renderSnippet, type GridColumns } from '@svgrid/grid';
	import type { ServerDataSource } from '@svgrid/grid/server';
	import { APP_NAME } from '#lib/config.ts';

	type Row = { id: number; at: string; actorEmail: string | null; action: string; target: string | null };

	// The grid asks for the block of rows under the viewport; ./rows answers
	// with that block and the total, filtered and sorted in SQL. 100k rows
	// scroll as one list without ever being in the browser at once.
	const source: ServerDataSource<Row> = {
		async getRows({ startRow, endRow, sortModel, filterModel, signal }) {
			const res = await fetch('/admin/audit/rows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startRow, endRow, sortModel, filterModel }),
				signal
			});
			if (!res.ok) throw new Error(`Audit rows failed: ${res.status}`);
			const { rows, total } = (await res.json()) as { rows: Row[]; total: number };
			return { rows, rowCount: total };
		}
	};
	let total = $state(0);
	const rows = createServerDataSource(source, {
		mode: 'infinite',
		blockSize: 100,
		maxBlocksInCache: 20,
		onChange: (s) => (total = s.rowCount ?? s.total)
	});

	const area = (action: string) => action.split('.')[0];
	const tone: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = { auth: 'neutral', project: 'info', admin: 'warning' };

	const columns: GridColumns<Row> = [
		{ field: 'at', header: 'When', width: 190, cellDataType: 'date', format: { type: 'datetime', pattern: 'medium' } },
		{ field: 'actorEmail', header: 'Who', width: 260, hideBelow: 640 },
		{ field: 'action', header: 'Action', width: 190, cell: (ctx) => renderSnippet(actionBadge, { action: String(ctx.getValue()) }) },
		{ field: 'target', header: 'Target', width: 160, hideBelow: 640 }
	];
</script>

{#snippet actionBadge(p: { action: string })}
	<SvBadge variant={tone[area(p.action)] ?? 'neutral'} size="sm">{p.action}</SvBadge>
{/snippet}

<svelte:head><title>Audit log · {APP_NAME}</title></svelte:head>

<h1 class="mb-1 text-xl font-semibold">
	Audit log {#if total > 0}<span class="text-muted">({total.toLocaleString()})</span>{/if}
</h1>
<p class="mb-3 text-sm text-muted">Newest first. Sort and filter run in the database; rows load as you scroll.</p>

<SvGrid rowModel={rows} {columns} getRowId={(row) => String(row.id)} fitColumns responsive showRowSelection={false} sortable filterable containerHeight={600} />
