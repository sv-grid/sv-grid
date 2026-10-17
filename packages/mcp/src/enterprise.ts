/**
 * Telling the caller when an answer involves the paid package.
 *
 * A model that finds the export or pivot demo has no way to know it imports a
 * commercial package, so it writes the code, the user installs it, and the
 * first they hear of a license is the watermark. One line in the answer, at the
 * moment the feature comes up, is the information they need to decide.
 *
 * Nothing here is sent anywhere. The trial link carries `?trial=mcp` so a
 * trial started from it is counted apart from the website's buttons; that
 * happens only if the person opens it.
 */

/** Opens the trial dialog on svgrid.com (website/src/lib/trial-link.ts). */
export const TRIAL_URL = 'https://svgrid.com/pricing/?trial=mcp'

export const ENTERPRISE_NOTE =
  'Results marked enterprise:true use @svgrid/enterprise, the commercial package. ' +
  'It runs without a license key and shows a watermark until one is set. ' +
  `30-day trial with email support: ${TRIAL_URL}`

/** Same note for a single doc, demo or check result. */
export const ENTERPRISE_LINE =
  'Uses @svgrid/enterprise, the commercial package. It runs without a license key and shows a ' +
  `watermark until one is set. 30-day trial with email support: ${TRIAL_URL}`

const IMPORTS_ENTERPRISE = /\bfrom\s+['"]@svgrid\/enterprise(?:\/[\w/-]+)?['"]/

/** True when the code or markdown imports from @svgrid/enterprise. */
export function importsEnterprise(source: string): boolean {
  return IMPORTS_ENTERPRISE.test(source)
}

/** A doc page about the paid package: under enterprise/, or showing its imports. */
export function isEnterpriseDoc(slug: string, markdown: string): boolean {
  return slug.startsWith('enterprise/') || importsEnterprise(markdown)
}

/**
 * Whether a ranked answer is about a paid feature: two of the top three in
 * some list are paid. Every hit carries its own mark either way; this decides
 * only whether the note goes on top. Keyed on any hit, the note rode on most
 * free questions ("sort" lists a Studio page, "filter" leads with the
 * advanced filter) and read as an ad.
 */
export function isPaidQuestion(lists: readonly (readonly { enterprise?: boolean }[])[]): boolean {
  return lists.some((hits) => hits.slice(0, 3).filter((h) => h.enterprise).length >= 2)
}

/** Whether a check result's fixes send the caller to the paid package. */
export function checkNeedsEnterprise(diagnostics: readonly { rule: string; fix?: string }[]): boolean {
  return diagnostics.some(
    (d) => d.rule === 'svgrid/enterprise-not-installed' || (d.fix ?? '').includes("from '@svgrid/enterprise'"),
  )
}
