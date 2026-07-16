// Vercel KV wrapper — falls back to in-memory for local dev
let kv;
try {
  kv = require('@vercel/kv').kv;
} catch {}

// Simple in-memory fallback for dev
const mem = {};
const memKV = {
  async hset(key, obj) { mem[key] = { ...(mem[key] || {}), ...obj }; },
  async hgetall(key) { return mem[key] || null; },
  async sadd(key, ...vals) { if (!mem[key]) mem[key] = new Set(); vals.forEach(v => mem[key].add(v)); },
  async smembers(key) { return mem[key] ? [...mem[key]] : []; },
  async srem(key, val) { if (mem[key]) mem[key].delete(val); },
  async del(key) { delete mem[key]; },
  async incr(key) { mem[key] = (mem[key] || 0) + 1; return mem[key]; },
  async get(key) { return mem[key] ?? null; },
  async set(key, val) { mem[key] = val; },
  async lpush(key, ...vals) { mem[key] = [...vals.reverse(), ...(mem[key] || [])]; },
  async ltrim(key, start, stop) { if (mem[key]) mem[key] = mem[key].slice(start, stop < 0 ? mem[key].length + stop + 1 : stop + 1); },
  async lrange(key, start, stop) { return mem[key] ? mem[key].slice(start, stop < 0 ? mem[key].length + stop + 1 : stop + 1) : []; },
};

const db = kv || memKV;

export default db;
