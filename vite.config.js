import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/Components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/Pages': path.resolve(__dirname, './src/pages'),
      '@/context': path.resolve(__dirname, './src/context'),
      '@/Context': path.resolve(__dirname, './src/context'),
    },
  },

  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
      binaryInterval: 1000,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        /[\\/]node_modules[\\/]/,
        /[\\/]\.git[\\/]/,
        /[\\/]dist[\\/]/,
      ],
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://213.210.36.19:5001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://213.210.36.19:5001');
            proxyReq.setHeader('referer', 'http://213.210.36.19:5001');
          });
        }
      },
      '/uploads': {
        target: 'http://213.210.36.19:5001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://213.210.36.19:5001');
            proxyReq.setHeader('referer', 'http://213.210.36.19:5001');
          });
        }
      }
    }
  },

  build: {
    outDir: 'dist',
  },
})