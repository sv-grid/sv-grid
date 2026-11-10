<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import {
		SvBadge,
		SvButton,
		SvEmptyState,
		SvGrid,
		SvPopconfirm,
		renderSnippet,
		type GridColumns,
		type SvGridApi
	} from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import { callAction, failureMessage } from '#lib/actions.ts';
	import { PROJECT_STATUS, projectFieldError, type EditableField, type ProjectStatus } from '#lib/projects.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.rows)[number];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let api = $state<SvGridApi<any, Row> | null>(null);
	let selected = $state<string[]>([]);
	let status = $state('');
	let error = $state('');
	/** Set when the create action refused because of the plan limit. */
	let upgrade = $state(false);

	const tone: Record<ProjectStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
		planned: 'neutral',
		active: 'info',
		paused: 'warning',
		done: 'success'
	};

	// `validate` + `rejectInvalid` stop a bad value in the browser, with the
	// same rule the server applies (src/lib/projects.ts).
	const rule = (field: EditableField) => ({
		rejectInvalid: true,
		validate: ({ value }: { value: unknown }) => projectFieldError(field, value)
	});

	const columns: GridColumns<Row> = [
		{ field: 'name', header: 'Project', width: 220, editorType: 'text', ...rule('name') },
		{ field: 'client', header: 'Client', width: 170, editorType: 'text', hideBelow: 640, ...rule('client') },
		{
			field: 'status',
			header: 'Status',
			width: 120,
			editorType: 'list',
			editorOptions: [...PROJECT_STATUS],
			cell: (ctx) => renderSnippet(statusBadge, { value: ctx.getValue() as ProjectStatus }),
			...rule('status')
		},
		{
			field: 'budget',
			header: 'Budget',
			width: 130,
			editorType: 'number',
			hideBelow: 640,
			format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
			...rule('budget')
		},
		{ field: 'dueDate', header: 'Due', width: 140, editorType: 'date', format: { type: 'date', pattern: 'medium' }, ...rule('dueDate') },
		{ field: 'updatedAt', header: 'Updated', width: 170, hideBelow: 900, editable: false, format: { type: 'datetime', pattern: 'short' } }
	];

	// One cell, one request. On failure the old value goes back into the
	// grid, so the screen never disagrees with the database.
	async function save(e: { rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown; row: Row }) {
		error = '';
		status = 'Saving...';
		const result = await callAction('?/update', { id: e.row.id, field: e.columnId, value: e.newValue as string | number | null });
		const message = failureMessage(result);
		if (message) {
			api?.setCellValue(e.rowIndex, e.columnId, e.oldValue);
			error = message;
			status = '';
			return;
		}
		if (result.type === 'success' && result.data?.row) {
			api?.setCellValue(e.rowIndex, 'updatedAt', (result.data.row as Row).updatedAt);
		}
		status = 'Saved';
	}

	async function create() {
		error = '';
		upgrade = false;
		const result = await callAction('?/create', {});
		const message = failureMessage(result);
		if (message) {
			upgrade = result.type === 'failure' && Boolean(result.data?.upgrade);
			return void (error = message);
		}
		await invalidateAll();
		await tick();
		// The new row is first (newest first): put the cursor in its name.
		api?.scrollToRow(0);
		api?.startEditing(0, 'name');
	}

	async function remove() {
		error = '';
		upgrade = false;
		const result = await callAction('?/delete', { id: selected });
		const message = failureMessage(result);
		if (message) return void (error = message);
		api?.clearRowSelection();
		selected = [];
		await invalidateAll();
		status = result.type === 'success' ? `Deleted ${result.data?.deleted ?? 0}` : '';
	}
</script>

{#snippet statusBadge(p: { value: ProjectStatus })}
	<SvBadge variant={tone[p.value] ?? 'neutral'} size="sm">{p.value}</SvBadge>
{/snippet}

<svelte:head><title>Projects · {APP_NAME}</title></svelte:head>

<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-xl font-semibold">
		Projects
		<span class="text-base font-normal text-muted">
			{data.limit === null ? data.rows.length : `${data.rows.length} of ${data.limit} on ${data.plan}`}
		</span>
	</h1>
	<div class="flex items-center gap-2">
		<span class="text-sm text-muted" role="status" aria-live="polite">{status}</span>
		{#if selected.length}
			<SvPopconfirm
				title="Delete {selected.length} project{selected.length === 1 ? '' : 's'}?"
				description="This can't be undone."
				confirmLabel="Delete"
				confirmVariant="danger"
				onConfirm={remove}
			>
				{#snippet anchor()}<SvButton variant="outline" size="sm">Delete {selected.length}</SvButton>{/snippet}
			</SvPopconfirm>
		{/if}
		{#if data.rows.length}
			<!-- The free CSV export: the rows as filtered and sorted on screen. -->
			<SvButton variant="outline" size="sm" onclick={() => api?.exportCsv({ filename: 'projects' })}>Export CSV</SvButton>
		{/if}
		<SvButton variant="primary" size="sm" onclick={create}>New project</SvButton>
	</div>
</header>

{#if error}
	<p class="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
		{error}
		{#if upgrade}<a href="/billing" class="font-medium underline">See plans</a>{/if}
	</p>
{/if}

{#if data.rows.length}
	<p class="mb-2 text-sm text-muted">Double-click a cell to edit it. Changes save as you go.</p>
	<SvGrid
		data={data.rows}
		{columns}
		getRowId={(row) => row.id}
		editable
		sortable
		filterable
		fitColumns
		responsive
		containerHeight={560}
		onCellValueChange={save}
		onRowSelectionChange={(_, rows) => (selected = rows.map((r) => r.id))}
		onApiReady={(a) => (api = a)}
	/>
{:else}
	<SvEmptyState title="No projects yet" description="Create one and edit it right in the grid.">
		<SvButton variant="primary" onclick={create}>New project</SvButton>
	</SvEmptyState>
{/if}
