import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Build бүрт өвөрмөц ID — клиент /version.json-той харьцуулж шинэ хувилбар гарсныг мэднэ
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || Date.now().toString(36);

function versionFile() {
  return {
    name: 'noone-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Локал хөгжүүлэлтэд VITE_SERVER_URL хоосон бол /socket.io, /api-г backend руу proxy хийнэ.
  const target = env.DEV_PROXY_TARGET || 'http://localhost:4000';
  return {
    plugins: [react(), versionFile()],
    define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
