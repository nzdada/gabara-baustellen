import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { ermittleVersionskennung } from '../scripts/versionskennung.mjs'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Versionskennung (AP 3): Bau-Datum + Git-Hash als globale Konstante –
  // Fußzeile und Fehlerprotokoll lesen sie über shared/version.js.
  define: {
    __GABARA_VERSION__: JSON.stringify(ermittleVersionskennung()),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
})
