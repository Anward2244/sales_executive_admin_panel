import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'node:http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL || env.VITE_BACKEND_URL || 'http://213.210.36.19:5001';
  const proxyAgent = new http.Agent({ keepAlive: false });

  return {
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
          target,
          changeOrigin: true,
          secure: false,
          agent: proxyAgent,
          headers: {
            Connection: 'close',
          },
          timeout: 60000,
          proxyTimeout: 60000,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              console.warn(`[vite proxy error] ${req.method} ${req.url}:`, err.message);
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  message: `Backend proxy error: ${err.message}`,
                  target
                }));
              }
            });
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('origin', target);
              proxyReq.setHeader('referer', target);
              proxyReq.setHeader('connection', 'close');
            });
          }
        },
        '/uploads': {
          target,
          changeOrigin: true,
          secure: false,
          agent: proxyAgent,
          headers: {
            Connection: 'close',
          },
          timeout: 60000,
          proxyTimeout: 60000,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              console.warn(`[vite proxy error] ${req.method} ${req.url}:`, err.message);
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  message: `Backend proxy error: ${err.message}`,
                  target
                }));
              }
            });
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('origin', target);
              proxyReq.setHeader('referer', target);
              proxyReq.setHeader('connection', 'close');
            });
          }
        }
      }
    },

    build: {
      outDir: 'dist',
    },
  };
});
