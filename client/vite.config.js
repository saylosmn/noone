import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Локал хөгжүүлэлтэд VITE_SERVER_URL хоосон бол /socket.io, /api-г backend руу proxy хийнэ.
  const target = env.DEV_PROXY_TARGET || 'http://localhost:4000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    build: { sourcemap: false, target: 'es2020' },
  };
});
