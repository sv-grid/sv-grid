/**
 * Refuse to regenerate a committed artifact from a checkout that cannot
 * produce a correct one.
 *
 * Three generators read more than the files they write. `build-docs-index`
 * takes each page's `lastUpdated` from the file's mtime and writes the served
 * copies into `website/public`; `build-manifests` reads the demo registry out
 * of the website submodule; `build-changelog` walks the `grid-v*` release
 * tags. A shallow clone has no tags and gives every file the same checkout
 * mtime, and the website submodule is private, so a contributor without it
 * has neither.
 *
 * Run in that state, each script used to succeed and write a plausible file:
 * every demo category reset to "Other", every `lastUpdated` flattened to the
 * clone date, the changelog down to the handful of releases the clone can
 * still see. The output looks fine in review and the loss only shows up later,
 * which is the worst shape a bug can have. So the check is a refusal, not a
 * warning.
 *
 * `--force` is there for the case where someone genuinely wants the degraded
 * output and has said so out loud.
 *
 * Deliberately NOT guarded: `build-docs-index` takes `lastUpdated` from file
 * mtimes, which a fresh clone sets to the checkout time. deploy-website.yml
 * clones the website into place but checks the main repo out at depth 1, so
 * refusing on that would break the site deploy on every run. It only affects
 * the deployed copy (CI does not commit docs.json back), so the committed file
 * is safe, and the fix is to derive the date from git rather than the
 * filesystem. Left alone here on purpose.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Does `root` sit in a shallow clone? Unknown (no git, not a repo) reads as
 *  false: a tarball export is not evidence of truncated history. */
export function isShallowClone(root) {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === 'true'
  } catch {
    return false
  }
}

/** Is the private website submodule checked out, rather than an empty gitlink? */
export function hasWebsiteCheckout(root) {
  return existsSync(join(root, 'website', 'src', 'lib'))
}

/** Are any tags matching `prefix` present? */
export function hasReleaseTags(root, prefix) {
  try {
    return execFileSync('git', ['tag', '--list', `${prefix}*`], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0
  } catch {
    return false
  }
}

/**
 * Turn the tree's state into the list of reasons this generator must not run.
 * Pure, so the wiring is testable without a repo in a given state.
 *
 * `needs` is any of: 'website', 'tags', 'fullHistory'.
 */
export function missingInputs(state, needs) {
  const problems = []
  if (needs.includes('website') && !state.website) {
    problems.push(
      'the private website/ submodule is not checked out, so the files it owns ' +
        '(the demo registry, the blog index, the served copies under ' +
        'website/public) are unreachable',
    )
  }
  if (needs.includes('tags') && !state.tags) {
    problems.push('no release tags are present, so the release history cannot be walked')
  }
  if (needs.includes('fullHistory') && state.shallow) {
    problems.push('this is a shallow clone, so the commit history is truncated')
  }
  return problems
}

/** Build the refusal message. Separate from the throw so a test can read it. */
export function refusalMessage(name, problems) {
  return [
    `${name}: refusing to write, because this checkout cannot produce a correct file.`,
    ...problems.map((p) => `  - ${p}`),
    '',
    '  Writing anyway would silently drop data that is already committed.',
    '  Fix the checkout (git submodule update --init, git fetch --unshallow --tags),',
    '  or pass --force if you intend the degraded output.',
  ].join('\n')
}

/**
 * Inspect the tree and exit non-zero unless it can produce a correct artifact.
 * Call once, before any write.
 */
export function guardGenerator({ root, name, needs, argv = process.argv, tagPrefix = '' }) {
  if (argv.includes('--force')) return
  const state = {
    shallow: isShallowClone(root),
    website: hasWebsiteCheckout(root),
    tags: needs.includes('tags') ? hasReleaseTags(root, tagPrefix) : true,
  }
  const problems = missingInputs(state, needs)
  if (problems.length === 0) return
  console.error(refusalMessage(name, problems))
  process.exit(1)
}
