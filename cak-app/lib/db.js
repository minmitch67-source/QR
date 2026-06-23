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
};

const db = kv || memKV;

export default db;
