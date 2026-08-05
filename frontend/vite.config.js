import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('html2canvas')) {
            return 'pdf-html-vendor'
          }

          if (id.includes('jspdf-autotable')) {
            return 'pdf-table-vendor'
          }

          if (id.includes('jspdf')) {
            return 'pdf-core-vendor'
          }

          if (id.includes('recharts')) {
            return 'charts-vendor'
          }

          if (id.includes('lucide-react')) {
            return 'icons-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
