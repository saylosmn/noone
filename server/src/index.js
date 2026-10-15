import { createApp } from './app.js';

const server = createApp();

const address = await server.listen(server.config.port, '0.0.0.0');
console.log(`[noone] сервер ${address.port} порт дээр ажиллаж байна`);
console.log(`[noone] зөвшөөрсөн frontend: ${server.config.clientOrigins.join(', ')}`);
console.log(`[noone] Web Push: ${server.push.enabled ? 'идэвхтэй' : `идэвхгүй (${server.push.reason})`}`);
console.log('[noone] Анхаар: дараалал, өрөө санах ойд л байдаг — сервер дахин асахад арилна.');

const shutdown = async (signal) => {
  console.log(`[noone] ${signal} — унтарч байна`);
  await server.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
