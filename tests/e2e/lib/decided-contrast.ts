/**
 * White text the product owner chose, which axe marks: on Ember's orange, and on a
 * saturated option color in a chip or a bar. Both are stated under 1.4.3 in
 * docs/compliance/vpat.md. Everything else axe finds is a fault.
 */
type Node = { html?: string; any: Array<{ data?: unknown }> }

const OPTION_INK = /sv-fsl-pill|sv-fse-pill|sv-fcv-pill|sv-gantt-bar/

export function isDecidedContrast(rule: string, node: Node): boolean {
  const data = node.any[0]?.data as { fgColor?: string; bgColor?: string } | undefined
  if (rule !== 'color-contrast' || data?.fgColor !== '#ffffff') return false
  return data.bgColor === '#ff3e00' || data.bgColor === '#ff5a1f' || OPTION_INK.test(node.html ?? '')
}
