/**
 * Helpers shared by every component builder: sizes, variant names and the
 * SvField frame (label, control, hint) that most inputs sit in.
 */
import { type Ink, component, num, ring, text } from './lib'

export type Size = 'sm' | 'md' | 'lg'
export const SIZES: Size[] = ['sm', 'md', 'lg']
export const R = () => num('--sg-radius')
export const vname = (props: Record<string, string>) => Object.entries(props).map(([k, val]) => `${k}=${val}`).join(', ')

export type UiKit = Record<string, ComponentSetNode | ComponentNode>

/** SvField.svelte:178-211: label, control, hint/error stacked with a 3px gap. */
export function field(name: string, control: SceneNode, invalid: boolean): ComponentNode {
  return component(
    { name, dir: 'v', gap: 3 },
    text('Label', { name: 'Label', size: 12.5, weight: 'medium', lineHeight: 16 }),
    control,
    invalid
      ? text('This field is required', { name: 'Hint', size: 11.5, weight: 'medium', lineHeight: 15.5, color: '--sg-danger' })
      : text('Helper text', { name: 'Hint', size: 11.5, lineHeight: 15.5, color: '--sg-muted' }),
  )
}

/** SvField.svelte:287-292 control heights and font sizes. */
export const FIELD: Record<Size, { h: number; fs: number }> = {
  sm: { h: 28, fs: 12 },
  md: { h: 34, fs: 13 },
  lg: { h: 40, fs: 15 },
}

export function borderFor(state: string): Ink {
  if (state === 'Invalid') return '--sg-danger'
  if (state === 'Focus' || state === 'Open') return '--sg-accent'
  return '--sg-input-border'
}

/** Focus halo: box-shadow 0 0 0 2px color-mix(accent 22%, transparent). */
export function halo(box: FrameNode, state: string, radius = R()): void {
  if (state === 'Focus' || state === 'Open') ring(box, { width: 2, ink: ['--sg-accent', 0.22], radius, name: 'Focus halo' })
}

/** Focus ring: outline 2px solid var(--sg-focus-ring), offset 2px. */
export function focusRing(box: FrameNode | ComponentNode, radius: number, offset = 2): void {
  ring(box, { width: 2, offset, ink: '--sg-focus-ring', radius })
}
