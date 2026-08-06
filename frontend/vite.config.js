import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8082'

  return {
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
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
