import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';

/**
 * Энгийн key-value хадгалалт. Нууц ханын (confession) өгөгдлийг сервер дахин асахад
 * алдагдуулахгүйн тулд ашиглана.
 *
 *  - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash Redis (үнэгүй, Render-д тохиромжтой)
 *  - CONFESSION_FILE → локал JSON файл (хөгжүүлэлтэд)
 *  - аль нь ч үгүй → зөвхөн санах ой (сервер дахин асахад арилна)
 */
export function createKv({ upstashUrl, upstashToken, file } = {}) {
  if (upstashUrl && upstashToken) {
    const base = upstashUrl.replace(/\/$/, '');
    const command = async (args) => {
      const res = await fetch(base, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(8000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) throw new Error(body.error || `HTTP ${res.status}`);
      return body.result;
    };
    return {
      kind: 'upstash',
      async get(key) {
        const raw = await command(['GET', key]);
        return raw == null ? null : JSON.parse(raw);
      },
      async set(key, value) {
        await command(['SET', key, JSON.stringify(value)]);
      },
      async del(key) {
        await command(['DEL', key]);
      },
    };
  }

  if (file) {
    // Үндсэн түлхүүр → `file`; бусад (жишээ нь зураг) → `${file}.d/<түлхүүр>.json`
    const pathFor = (key) =>
      key.startsWith('noone:confessions:') ? file : `${file}.d/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    return {
      kind: 'file',
      async get(key) {
        try {
          return JSON.parse(await readFile(pathFor(key), 'utf8'));
        } catch (err) {
          if (err.code === 'ENOENT') return null;
          throw err;
        }
      },
      async set(key, value) {
        const target = pathFor(key);
        if (target !== file) await mkdir(`${file}.d`, { recursive: true });
        const tmp = `${target}.tmp`;
        await writeFile(tmp, JSON.stringify(value));
        await rename(tmp, target);
      },
      async del(key) {
        await rm(pathFor(key), { force: true });
      },
    };
  }

  const mem = new Map();
  return {
    kind: 'memory',
    async get(key) {
      return mem.has(key) ? structuredClone(mem.get(key)) : null;
    },
    async set(key, value) {
      mem.set(key, structuredClone(value));
    },
    async del(key) {
      mem.delete(key);
    },
  };
}
