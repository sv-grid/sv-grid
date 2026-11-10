<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { SvBadge, SvButton, SvGrid, SvTextInput, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid';
	import { APP_NAME } from '#lib/config.ts';
	import { callAction, failureMessage } from '#lib/actions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.rows)[number];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let api = $state<SvGridApi<any, Row> | null>(null);
	let selected = $state<Row[]>([]);
	let status = $state('');
	let error = $state('');

	const columns: GridColumns<Row> = [
		{ field: 'name', header: 'Name', width: 200 },
		{ field: 'email', header: 'Email', width: 280, hideBelow: 640 },
		{
			field: 'role',
			header: 'Role',
			width: 110,
			editorType: 'list',
			editorOptions: ['user', 'admin'],
			// Everyone's role but your own; the server refuses that too.
			editable: (ctx) => ctx.row.original.id !== data.user.id,
			cell: (ctx) => renderSnippet(roleBadge, { role: String(ctx.getValue() ?? 'user') })
		},
		{
			field: 'banned',
			header: 'Status',
			width: 110,
			cell: (ctx) => renderSnippet(bannedBadge, { banned: Boolean(ctx.getValue()) })
		},
		{ field: 'createdAt', header: 'Joined', width: 150, hideBelow: 640, format: { type: 'date', pattern: 'medium' } }
	];

	const pages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

	// Sort, search and page live in the URL: the page is server-rendered in
	// that order, links are shareable, and Back works.
	function go(changes: Record<string, string | null>) {
		const next = new URL(page.url.href);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === '') next.searchParams.delete(key);
			else next.searchParams.set(key, value);
		}
		goto(next, { reset: false });
	}

	function onSortingChange(sorting: Array<{ id: string; desc: boolean }>) {
		const first = sorting[0];
		go({ sort: first?.id ?? null, dir: first ? (first.desc ? 'desc' : 'asc') : null, page: null });
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function onSearch(value: string) {
		clearTimeout(timer);
		timer = setTimeout(() => go({ q: value, page: null }), 250);
	}

	async function onCellValueChange(e: { rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown; row: Row }) {
		if (e.columnId !== 'role') return;
		error = '';
		const message = failureMessage(await callAction('?/setRole', { userId: e.row.id, role: String(e.newValue) }));
		if (message) {
			api?.setCellValue(e.rowIndex, 'role', e.oldValue);
			error = message;
			return;
		}
		status = `${e.row.name} is now ${e.newValue}`;
	}

	async function setBanned(ban: boolean) {
		error = '';
		const ids = selected.map((r) => r.id);
		const message = failureMessage(await callAction(ban ? '?/ban' : '?/unban', { id: ids }));
		if (message) return void (error = message);
		api?.clearRowSelection();
		selected = [];
		await invalidateAll();
		status = `${ban ? 'Banned' : 'Unbanned'} ${ids.length}`;
	}
</script>

{#snippet roleBadge(p: { role: string })}
	<SvBadge variant={p.role === 'admin' ? 'accent' : 'neutral'} size="sm">{p.role}</SvBadge>
{/snippet}
{#snippet bannedBadge(p: { banned: boolean })}
	{#if p.banned}<SvBadge variant="danger" size="sm">Banned</SvBadge>{:else}<span class="text-sm text-muted">Active</span>{/if}
{/snippet}

<svelte:head><title>Users · {APP_NAME}</title></svelte:head>

<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-xl font-semibold">Users <span class="text-muted">({data.total})</span></h1>
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-sm text-muted" role="status" aria-live="polite">{status}</span>
		{#if selected.length}
			<SvButton variant="outline" size="sm" onclick={() => setBanned(true)}>Ban {selected.length}</SvButton>
			<SvButton variant="outline" size="sm" onclick={() => setBanned(false)}>Unban {selected.length}</SvButton>
		{/if}
		<div class="w-60 max-w-full">
			<SvTextInput type="search" placeholder="Search name or email" value={data.q} onChange={onSearch} clearable />
		</div>
	</div>
</header>

{#if error}
	<p class="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>
{/if}

<p class="mb-2 text-sm text-muted">Double-click a role to change it. Select rows to ban or unban; banning signs the user out everywhere.</p>

<SvGrid
	data={data.rows}
	{columns}
	getRowId={(row) => row.id}
	editable
	fitColumns
	responsive
	sortable
	externalSort
	initialSorting={[{ id: data.sort, desc: data.dir === 'desc' }]}
	{onSortingChange}
	{onCellValueChange}
	onRowSelectionChange={(_, rows) => (selected = rows)}
	onApiReady={(a) => (api = a)}
	containerHeight={520}
/>

<nav class="mt-3 flex items-center justify-end gap-3 text-sm" aria-label="Pages">
	<SvButton variant="outline" size="sm" disabled={data.page === 0} onclick={() => go({ page: String(data.page - 1) })}>Previous</SvButton>
	<span>Page {data.page + 1} of {pages}</span>
	<SvButton variant="outline" size="sm" disabled={data.page + 1 >= pages} onclick={() => go({ page: String(data.page + 1) })}>Next</SvButton>
</nav>
