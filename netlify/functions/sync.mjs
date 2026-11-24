// Ilovadagi eslatmalar ro'yxatini serverga saqlaydi (POST /api/sync).
import { json, readBody, rateLimit, store, userKey, adminChat, sendText } from '../lib/tg.mjs';

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const okId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const okTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const okDate = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v);
const okAt = v => Number.isFinite(v) && v > 1.5e12 && v < 4.2e12;

export function clean(d) {
  if (!d || typeof d !== 'object') return null;
  const habits = (Array.isArray(d.habits) ? d.habits : []).slice(0, 200)
    .filter(h => h && okId(h.id) && okTime(h.time) && str(h.name, 80))
    .map(h => ({
      id: h.id, name: str(h.name, 80), time: h.time,
      days: [...new Set((Array.isArray(h.days) ? h.days : []).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))],
      done: (Array.isArray(h.done) ? h.done : []).filter(okDate).slice(0, 3),
    }));
  const tasks = (Array.isArray(d.tasks) ? d.tasks : []).slice(0, 500)
    .filter(t => t && okId(t.id) && okAt(t.at) && str(t.title, 200))
    .map(t => ({ id: t.id, title: str(t.title, 200), at: t.at }));
  const tm = d.timer;
  const timer = tm && okAt(tm.at) ? { at: tm.at, phase: tm.phase === 'break' ? 'break' : 'focus', name: str(tm.name, 80) } : null;
  const off = Number.isInteger(d.off) && Math.abs(d.off) <= 14 * 60 ? d.off : 0;
  let tz = str(d.tz, 64);
  try { if (tz) new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = ''; }
  return { tz, off, habits, tasks, timer };
}

export default async req => {
  const { body, user, err } = await readBody(req, 200_000);
  if (err) return err;
  if (!(await rateLimit(user.id, 'sync', 20))) return json({ ok: false, err: 'juda koʻp soʻrov, birozdan keyin' }, 429);
  const data = clean(body.data);
  if (!data) return json({ ok: false, err: 'notoʻgʻri maʼlumot' }, 400);

  const s = store(), key = userKey(user.id);
  const prev = (await s.get(key, { type: 'json' })) || null;
  await s.setJSON(key, { chat: user.id, data, sent: (prev && prev.sent) || {}, updated: Date.now() });

  // Admin chatiga (agar TELEGRAM_CHAT_ID berilgan bo'lsa) yangi foydalanuvchi haqida qisqa xabar.
  if (!prev && adminChat()) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Nomaʼlum';
    sendText(adminChat(), `Yangi foydalanuvchi ulandi: ${name}${user.username ? ' (@' + user.username + ')' : ''}`).catch(() => {});
  }
  return json({ ok: true });
};

export const config = { path: '/api/sync' };
