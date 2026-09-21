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
    alias: [
      // Direct exact case-match aliases for Windows file-system watchers
      { find: /^@\/components\/(.*)/, replacement: path.resolve(__dirname, './src/Components/$1') },
      { find: /^@\/Components\/(.*)/, replacement: path.resolve(__dirname, './src/Components/$1') },
      { find: /^@\/pages\/(.*)/, replacement: path.resolve(__dirname, './src/Pages/$1') },
      { find: /^@\/Pages\/(.*)/, replacement: path.resolve(__dirname, './src/Pages/$1') },
      { find: /^@\/context\/(.*)/, replacement: path.resolve(__dirname, './src/Context/$1') },
      { find: /^@\/Context\/(.*)/, replacement: path.resolve(__dirname, './src/Context/$1') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
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
        target: 'https://monster-airline-relevant-earn.trycloudflare.com',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'https://monster-airline-relevant-earn.trycloudflare.com');
            proxyReq.setHeader('referer', 'https://monster-airline-relevant-earn.trycloudflare.com');
          });
        }
      },
      '/uploads': {
        target: 'https://monster-airline-relevant-earn.trycloudflare.com',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'https://monster-airline-relevant-earn.trycloudflare.com');
            proxyReq.setHeader('referer', 'https://monster-airline-relevant-earn.trycloudflare.com');
          });
        }
      }
    }
  },

  build: {
    outDir: 'dist',
  },
})