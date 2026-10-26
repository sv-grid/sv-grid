import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite 7 so the project also runs in StackBlitz and Bolt, whose WebContainer
// cannot load Vite 8's native Rolldown bundler. A Lovable project brings its
// own build setup; only src/components/DataGrid.tsx and the CSS block in
// src/index.css need to move across.
export default defineConfig({
  plugins: [react()],
})
