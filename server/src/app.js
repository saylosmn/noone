import { createFriends } from './friends.js';
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
import { createConfessions } from './confessions.js';
import { createKv } from './kv.js';
import { createAdminAuth } from './adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const push = createPush(config);
  const reports = createReportLog({ file: config.reportLogFile, salt: config.reportHashSalt });
  const adminAuth = createAdminAuth(config);
  const confessions = createConfessions({
    config,
    adminAuth,
    push,
    kv: createKv({
      upstashUrl: config.confessions.upstashUrl,
      upstashToken: config.confessions.upstashToken,
      file: config.confessions.file,
    }),
  });

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
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
    });
    next();
  });

  // API-д зориулсан CORS
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && isAllowedOrigin(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Noone-Device',
        'Access-Control-Max-Age': '600',
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
    maxHttpBufferSize: 160 * 1024,
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  const friends = createFriends(createKv({ upstashUrl: config.confessions.upstashUrl, upstashToken: config.confessions.upstashToken, file: config.friendsFile || process.env.FRIENDS_FILE }));
  app.use('/api/friends', friends.router);
  const chat = attachChat(io, { config, push, reports, friends });

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

  // Нууц хана (confession)
  app.use('/api/confessions', confessions.router);
  app.use('/api/admin/auth', adminAuth.router);
  app.use('/api/admin/confessions', confessions.admin);

  // Админ: мэдээллийн жагсаалт (ADMIN_TOKEN тохируулсан үед л)
  app.get('/api/admin/chat-stats', (req, res) => {
    if (!adminAuth.isAuthorized(req)) return res.sendStatus(404);
    res.json({ dateMetrics: chat.stats().dateMetrics });
  });

  app.get('/api/admin/reports', (req, res) => {
    if (!adminAuth.isAuthorized(req)) {
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
    confessions,
    adminAuth,
    listen(port = config.port, host) {
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => resolve(httpServer.address()));
      });
    },
    async close() {
      await confessions.close();
      await new Promise((resolve) => io.close(() => resolve()));
      // Disconnect handlers create grace timers; clear them after sockets close.
      chat.close();
    },
  };
}
