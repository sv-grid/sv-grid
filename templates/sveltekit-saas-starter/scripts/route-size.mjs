// Gzipped JS + CSS a browser loads for each route of the production build, and
// how much more than the home page that is. Run after `npm run build`:
//
//   node scripts/route-size.mjs
//
// Counts static imports only (what loads before the page is interactive);
// dynamic imports load later, on demand.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const OUT = '.svelte-kit/output/client';
const manifest = JSON.parse(readFileSync(join(OUT, '.vite/manifest.json'), 'utf8'));
const app = readFileSync('.svelte-kit/generated/build/client-optimized/app.js', 'utf8');

const byFile = new Map(Object.entries(manifest).map(([key, chunk]) => [key, chunk]));
const keyOf = (suffix) => [...byFile.keys()].find((k) => k.endsWith(suffix));

// "/admin/users": [~4,[2]] -> leaf node 4, layout node 2; node 0 is the root layout.
const routes = [...app.matchAll(/^\s*"([^"]+)":\s*\[(.*)\],?$/gm)].map(([, id, spec]) => ({
	id,
	nodes: [0, ...(spec.match(/\d+/g) ?? []).map(Number)]
}));

const gz = new Map();
const size = (file) => {
	if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(join(OUT, file)), { level: 9 }).length);
	return gz.get(file);
};

function closure(keys) {
	const files = new Set();
	const seen = new Set();
	const walk = (key) => {
		if (!key || seen.has(key)) return;
		seen.add(key);
		const chunk = byFile.get(key);
		if (!chunk) return;
		files.add(chunk.file);
		for (const css of chunk.css ?? []) files.add(css);
		for (const imp of chunk.imports ?? []) walk(imp);
	};
	keys.forEach(walk);
	return files;
}

const entry = [keyOf('client/entry.js'), keyOf('client-optimized/app.js')];
const kb = (bytes) => (bytes / 1024).toFixed(1);
const rows = routes.map((r) => {
	const files = closure([...entry, ...r.nodes.map((n) => keyOf(`client-optimized/nodes/${n}.js`))]);
	return { id: r.id, files, total: [...files].reduce((sum, f) => sum + size(f), 0) };
});
const home = rows.find((r) => r.id === '/');

console.log('route'.padEnd(32), 'gzip KB'.padStart(8), 'vs /'.padStart(8));
for (const r of rows) {
	const extra = [...r.files].filter((f) => !home.files.has(f)).reduce((sum, f) => sum + size(f), 0);
	console.log(r.id.padEnd(32), kb(r.total).padStart(8), ('+' + kb(extra)).padStart(8));
}
