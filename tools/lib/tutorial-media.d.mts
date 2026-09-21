/** One caption cue / transcript line. Seconds on the published video's timeline. */
export type TutorialCue = { start: number; end: number; text: string }

/** One entry of tools/tutorials/manifest.json. */
export type TutorialEntry = {
  id: string
  /** A marketing cut is published on YouTube only: no docs page, no media under website/public. */
  kind?: 'marketing'
  title: string
  description: string
  /** Gallery demo id the tutorial was recorded on (null for a stage-only cut). */
  demo: string | null
  /** Repo-relative docs page carrying the block, e.g. "docs/help/editing/overview.md"; null for a marketing cut. */
  docsPage: string | null
  tags: string[]
  /** Seconds. */
  duration: number
  width: number
  height: number
  /** ISO date (YYYY-MM-DD) the assets were recorded. */
  recordedAt: string
  youtubeId: string | null
  /** ISO date the YouTube copy went up, else null. */
  publishedAt: string | null
  /** Root-relative site paths, e.g. "/tutorials/<id>.mp4". */
  files: { mp4: string | null; poster: string | null; vtt: string | null; webm?: string }
  bytes: { mp4: number; poster: number; master?: number }
  transcript: TutorialCue[]
}

export const TUTORIAL_RE: RegExp
export function escapeHtml(s: unknown): string
export function normalizeNarration(text: unknown): string
export function captionTime(seconds: number, sep?: string): string
export function cuesFromBeats(
  beats: Array<{ start: number; audioDuration?: number; end?: number; text: string }>,
  opts?: { tail?: number; gap?: number },
): TutorialCue[]
export function toSrt(cues: TutorialCue[]): string
export function toVtt(cues: TutorialCue[]): string
export function iso8601Duration(seconds: number): string
export function tutorialBlock(t: TutorialEntry): string
export function upsertBlock(
  pageText: string,
  id: string,
  block: string,
  opts?: { anchor?: string; anchorAfter?: string },
): { text: string; changed: boolean; inserted: boolean }
export function videoObjectLd(
  t: TutorialEntry,
  ctx: { origin: string; pageUrl: string },
): Record<string, unknown>
export function tutorialIdsIn(markdown: string): string[]
