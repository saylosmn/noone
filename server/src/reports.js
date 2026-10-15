import { appendFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Мэдээллийн бүртгэл — хамгийн бага мэдээлэл:
 *  - шалтгаан, цаг, чатын үргэлжлэх хугацаа (10 сек-ээр бөөрөнхийлсөн)
 *  - мэдээлсэн болон мэдээлэгдсэн түр ID-ийн давс нэмсэн hash
 * Мессеж, нэр, IP хаяг ХАДГАЛАХГҮЙ.
 */
export function createReportLog({ file, salt, max = 500 }) {
  const entries = [];

  const hash = (value) =>
    createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 12);

  return {
    hash,
    add({ reason, reporterId, reportedId, chatDurationMs }) {
      const entry = {
        id: `rep_${randomBytes(6).toString('hex')}`,
        at: new Date().toISOString(),
        reason,
        reporter: hash(reporterId),
        reported: hash(reportedId),
        chatDurationSec: Math.round((chatDurationMs || 0) / 10000) * 10,
      };
      entries.push(entry);
      if (entries.length > max) entries.shift();
      if (file) {
        appendFile(file, `${JSON.stringify(entry)}\n`).catch((err) =>
          console.warn(`[reports] файлд бичиж чадсангүй: ${err.message}`),
        );
      }
      return entry;
    },
    list() {
      return [...entries].reverse();
    },
    count() {
      return entries.length;
    },
  };
}
