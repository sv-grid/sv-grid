// Ambient declarations for pdfmake submodules we lazy-import. pdfmake
// itself ships no .d.ts files and there is no @types/pdfmake on npm that
// covers `build/*`. Kept as a separate script-style .d.ts (no top-level
// import/export) so it functions as an ambient declaration, not a module
// augmentation. Pulled into export.ts via a triple-slash reference so
// consumers of @svgrid/enterprise pick the declarations up automatically.

declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    vfs?: Record<string, string>
    createPdf(definition: unknown): {
      download(filename: string): void
      getBlob(callback: (blob: Blob) => void): void
    }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfsFonts: unknown
  export default vfsFonts
}
