// Zaxira faylini foydalanuvchining bot chatiga yuborish (POST /api/backup).
import { json, readBody, rateLimit, tg, tgErr, safe } from '../lib/tg.mjs';

const MAX = 4_000_000;

export default safe(async req => {
  const { body, user, err } = await readBody(req, MAX + 20_000);
  if (err) return err;
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) return json({ ok: false, err: 'zaxira boʻsh' }, 400);
  if (text.length > MAX) return json({ ok: false, err: 'zaxira juda katta' }, 413);
  if (!(await rateLimit(user.id, 'backup', 2, 30_000))) return json({ ok: false, err: 'biroz kutib, qayta urining' }, 429);
  const name = typeof body.name === 'string' && /^[\w.-]{1,80}\.json$/.test(body.name) ? body.name : 'odatlar-zaxira.json';

  const fd = new FormData();
  fd.append('chat_id', String(user.id));
  fd.append('caption', 'Odatlar zaxira fayli. Uni ilovadagi «Maʼlumotlarni import qilish» orqali tiklashingiz mumkin.');
  fd.append('document', new Blob([text], { type: 'application/json' }), name);
  const r = await tg('sendDocument', fd);
  return r.ok ? json({ ok: true }) : json({ ok: false, err: tgErr(r) }, 502);
});

export const config = { path: '/api/backup' };
