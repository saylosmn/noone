import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { loadConfig } from './config.js';
import { attachChat } from './chat.js';
import { createPush } from './push.js';
import { createReportLog } from './reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const push = createPush(config);
  const reports = createReportLog({ file: config.reportLogFile, salt: config.reportHashSalt });

  const isAllowedOrigin = (origin) => {
    if (!origin) return true; // same-origin эсвэл native клиент
    const clean = origin.replace(/\/$/, '');
    if (config.clientOrigins.includes('*') || config.clientOrigins.includes(clean)) return true;
    if (config.allowVercelPreviews) {
      try {
        return new URL(clean).hostname.endsWith('.vercel.app');
      } catch {
        return false;
      }
    }
    return false;
  };

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });

  // API-д зориулсан CORS
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    res.set('Cache-Control', 'no-store');
    next();
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  const chat = attachChat(io, { config, push, reports });

  app.get('/api/health', (req, res) => {
    const s = chat.stats();
    res.json({ ok: true, online: s.online, uptimeSec: Math.round(process.uptime()) });
  });

  app.get('/api/push/config', (req, res) => {
    res.json({
      enabled: push.enabled,
      publicKey: push.publicKey,
      reason: push.enabled ? '' : push.reason,
    });
  });

  // Админ: мэдээллийн жагсаалт (ADMIN_TOKEN тохируулсан үед л)
  app.get('/api/admin/reports', (req, res) => {
    if (!config.adminToken || req.get('authorization') !== `Bearer ${config.adminToken}`) {
      return res.sendStatus(404);
    }
    res.json({ stats: chat.stats(), reports: reports.list() });
  });

  // Нэг сервер дээр frontend-ийг хамт ажиллуулах боломж (client/dist байвал)
  const dist = path.resolve(__dirname, '../../client/dist');
  if (config.serveClient && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/socket\.io).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.type('text/plain').send('noone сервер ажиллаж байна. Frontend нь тусдаа (Vercel) байрлана.');
    });
  }

  return {
    app,
    io,
    httpServer,
    config,
    chat,
    push,
    reports,
    listen(port = config.port, host) {
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => resolve(httpServer.address()));
      });
    },
    async close() {
      chat.close();
      await new Promise((resolve) => io.close(() => resolve()));
    },
  };
}
