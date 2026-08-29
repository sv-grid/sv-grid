export function leadingComment(src: string): string
export function pitchFromSource(src: string): string
export function imports(src: string): string[]
export function featureRegistry(src: string): string[]
export function columnShape(src: string): string
export function columnFields(src: string): { field: string; header: string }[]
export function apiCalls(src: string): string[]
export function demoFacts(src: string): {
  imports: string[]
  features: string[]
  columns: { field: string; header: string }[]
  api: string[]
}
