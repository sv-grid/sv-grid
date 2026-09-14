/**
 * tools/tutorials/manifest.json - the tracked record of every recorded
 * tutorial. It lives in the parent repo (not the private website submodule)
 * because every consumer runs from the parent checkout: the docs embed, the
 * docs index builders, the prerenderer and the guardrail test. The media it
 * points at lives in website/public/tutorials/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const MANIFEST_PATH = join(ROOT, 'tools', 'tutorials', 'manifest.json')
export const SCRIPTS_DIR = join(ROOT, 'tools', 'tutorials', 'scripts')
export const OUT_DIR = join(ROOT, 'tutorials-out')
export const CACHE_DIR = join(ROOT, '.tutorials-cache')
export const SITE_MEDIA_DIR = join(ROOT, 'website', 'public', 'tutorials')

/** @returns {{ tutorials: import('../../lib/tutorial-media.d.mts').TutorialEntry[] }} */
export function readManifest(path = MANIFEST_PATH) {
  if (!existsSync(path)) return { tutorials: [] }
  const raw = readFileSync(path, 'utf-8').replace(/^﻿/, '')
  const data = JSON.parse(raw)
  return { tutorials: Array.isArray(data.tutorials) ? data.tutorials : [] }
}

export function writeManifest(manifest, path = MANIFEST_PATH) {
  const tutorials = [...manifest.tutorials].sort((a, b) => a.id.localeCompare(b.id))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ tutorials }, null, 2) + '\n', 'utf-8')
}

/** Replace the entry with the same id, or add it. Returns the new manifest. */
export function upsertTutorial(manifest, entry) {
  const rest = manifest.tutorials.filter((t) => t.id !== entry.id)
  return { tutorials: [...rest, entry] }
}

export function findTutorial(manifest, id) {
  return manifest.tutorials.find((t) => t.id === id) ?? null
}
