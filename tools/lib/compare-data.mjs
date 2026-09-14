/**
 * Node-side loader for the comparison data under docs/_data.
 *
 * The website imports the same JSON through Vite (website/src/lib/comparisons.ts);
 * this is the read for the prerenderer, the docs corpus builder, the MCP
 * manifest builder and the tests, so they all see the files the SPA sees.
 * Dependency-free: plain fs reads, no schema library.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const COMPARISONS_DIR = join(ROOT, 'docs', '_data', 'comparisons')
export const LEDGER_FILE = join(ROOT, 'docs', '_data', 'competitors.json')
export const SVGRID_SIZE_FILE = join(ROOT, 'docs', '_data', 'svgrid-size.json')

/** @param {string} file */
async function readJson(file) {
  const raw = await readFile(file, 'utf-8')
  return JSON.parse(raw.replace(/^﻿/, ''))
}

/**
 * Every comparison, in filename order (the hub and the corpus sort them
 * themselves). A file that does not parse throws: a typo must fail the build,
 * not silently drop a page.
 * @returns {Promise<import('../../website/src/lib/comparisons').Comparison[]>}
 */
export async function loadComparisons(dir = COMPARISONS_DIR) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  const out = []
  for (const f of files) {
    const data = await readJson(join(dir, f))
    if (data.slug !== f.replace(/\.json$/, '')) throw new Error(`compare-data: ${f} carries slug "${data.slug}"`)
    out.push(data)
  }
  return out
}

/**
 * The registry / bundle / benchmark ledger. Missing file -> empty ledger, so
 * a checkout without it still renders pages (without the At-a-glance rows).
 * @returns {Promise<import('./competitor-facts.mjs').Ledger>}
 */
export async function loadLedger(file = LEDGER_FILE) {
  try {
    const data = await readJson(file)
    return { registry: data.registry ?? {}, bundles: data.bundles ?? {}, benchmarks: data.benchmarks ?? null }
  } catch {
    return { registry: {}, bundles: {}, benchmarks: null }
  }
}

/**
 * SvGrid's own measured size, as packages/grid/scripts/measure-size.mjs --json
 * writes it. Missing -> null.
 * @returns {Promise<import('./competitor-facts.mjs').SvgridSize | null>}
 */
export async function loadSvgridSize(file = SVGRID_SIZE_FILE) {
  try {
    return await readJson(file)
  } catch {
    return null
  }
}
