import { forwardRef, lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import type { SvGridHandle, SvGridProps } from '@svgrid/grid-wc/react'

/**
 * SvGrid for a React app that renders on the server (Lovable's TanStack Start
 * template, Next.js, Remix) as well as one that does not.
 *
 * The grid is a custom element: there is nothing to render on a server, and
 * @svgrid/grid-wc 3.0.35 and earlier threw `customElements is not defined`
 * when a server imported them. So the module is loaded only in the browser,
 * after the first commit, and the server and the first client render both
 * emit the same empty box - no hydration mismatch, no layout jump.
 *
 * Copy this file into src/components/ and use it like the wrapper itself:
 *
 *   <DataGrid data={rows} columns={columns} sortable filterable height={520} />
 */
const SvGrid = lazy(() => import('@svgrid/grid-wc/react').then((m) => ({ default: m.SvGrid })))

export type DataGridProps = Omit<SvGridProps, 'className' | 'style'> & {
  /** The grid fills this box, so the box needs a height. Default 480. */
  height?: CSSProperties['height']
  className?: string
  style?: CSSProperties
}

export const DataGrid = forwardRef<SvGridHandle, DataGridProps>(function DataGrid(
  { height = 480, className, style, ...props },
  ref,
) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // `svgrid-theme` maps the grid's --sg-* tokens to the app's shadcn
  // variables (see the block in index.css).
  return (
    <div className={`svgrid-theme ${className ?? ''}`.trim()} style={{ height, ...style }}>
      {mounted && (
        <Suspense fallback={null}>
          <SvGrid ref={ref} {...props} />
        </Suspense>
      )}
    </div>
  )
})
