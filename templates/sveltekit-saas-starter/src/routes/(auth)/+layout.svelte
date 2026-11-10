<script lang="ts">
	import { APP_NAME } from '#lib/config.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<main class="flex min-h-screen flex-col items-center justify-center px-4 py-10">
	<a href="/" class="mb-6 text-lg font-semibold">{APP_NAME}</a>
	<div class="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-sm">
		{@render children()}
	</div>
</main>
