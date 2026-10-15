/**
 * Түлхүүр тус бүрт token bucket. Санах ойд л хадгална.
 */
export class KeyedLimiter {
  constructor({ capacity, refillPerSec }) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.buckets = new Map();
  }

  take(key, cost = 1) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, last: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = (now - bucket.last) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSec);
    bucket.last = now;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { ok: true };
    }
    const retryAfterMs = Math.ceil(((cost - bucket.tokens) / this.refillPerSec) * 1000);
    return { ok: false, retryAfterMs };
  }

  delete(key) {
    this.buckets.delete(key);
  }

  /** Бүрэн дүүрсэн (идэвхгүй) bucket-уудыг устгана. */
  sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      const tokens = bucket.tokens + ((now - bucket.last) / 1000) * this.refillPerSec;
      if (tokens >= this.capacity) this.buckets.delete(key);
    }
  }
}
