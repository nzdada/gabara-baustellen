import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
    // FastBill-API im Dev ohne CORS-Problem: Aufrufe gehen an /fastbill-api/...
    // und werden serverseitig an my.fastbill.com weitergereicht.
    // In Produktion (Firebase Hosting) übernimmt das eine GAS-Proxy-Web-App (V2).
    proxy: {
      '/fastbill-api': {
        target: 'https://my.fastbill.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/fastbill-api/, '/api/1.0'),
      },
    },
  },
})
