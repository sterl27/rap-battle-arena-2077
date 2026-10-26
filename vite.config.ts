import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // was '0.0.0.0'; keep the dev server loopback-only once it can drive Ableton through the proxy
        host: env.MUSAIX_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
        proxy: {
          // Option A (no relay change): browser -> same-origin /musaix/* -> relay. The relay only accepts
          // Host 127.0.0.1:8765|localhost:8765 and Origin http://localhost:8765 (or none), so rewrite
          // Host (changeOrigin) and drop Origin/Referer. Dev-only: production builds have no proxy.
          '/musaix': {
            target: 'http://127.0.0.1:8765',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/musaix/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (req) => { req.removeHeader('origin'); req.removeHeader('referer'); });
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
